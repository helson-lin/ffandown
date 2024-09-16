/** express server */
const express = require('express')
const ws = require('express-ws')
const cluster = require('cluster')
const path = require('path')
const colors = require('colors')
const bodyParser = require('body-parser')
const app = express()
const Utils = require('./utils/index')
const jsonParser = bodyParser.json()

// express static server
app.use(express.static(path.join(process.cwd(), 'public')))
/**
 * @description
 * @param {FFandown} this
 */
function createServer (port) {
    ws(app).getWss('/')

    const { getNetwork, initializeFrontEnd, modifyYml } = Utils

    // registerEventCallback
    this.registerEventCallback(({ name, status, url, message }) => {
        const isSuccess = status === '3'
        Utils.msg(this.config.webhooks, this.config.webhookType, 'ffandown notification', `${name}: ${isSuccess ? 'download successful' : 'download failed'}`)
        .catch(e => {
            Utils.LOG.warn('message failed:' + e)
        })
    })

    app.ws('/ws', (ws, req) => {
        ws.send(Utils.sendWsMsg('connected'))
        ws.on('message', async (msg) => {
            try {
                const data = JSON.parse(msg)
                const { key } = data
                if (key === 'list') {
                    const list = await this.dbOperation.getAll()
                    ws.send(Utils.sendWsMsg(list, 'list'))
                }
            } catch (e) {
                Utils.LOG.error('client:' + e)
            }
        })
        ws.on('close', function (e) {
            Utils.LOG.info('close connection')
        })
    })
    app.get('/config', async (req, res) => {
        res.send({ code: 0, data: this.config })
    })
    app.post('/config', jsonParser, async (req, res) => {
        const data = req.body
        data.port = Number(data.port)
        modifyYml(data)
        // sync data to config on instance
        this.config = data
        res.send({ code: 0, message: 'update success' })
    })
    // get version info
    app.get('/version', async (req, res) => {
        try {
            const version = await Utils.getFrontEndVersion()
            res.send({ code: 0, data: version })
        } catch (e) {
            res.send({ code: 1, message: e.message })
        }
    })
    // upgrade front end
    app.get('/upgrade', async (req, res) => {
        try {
            await Utils.autoUpdateFrontEnd()
            res.send({ code: 0, message: 'upgrade success' })
        } catch (e) {
            res.send({ code: 1, message: e.message })
        }
    })
    // create download mission
    app.post('/down', jsonParser, (req, res) => {
        let { name, url, preset, outputformat, useragent, dir, enableTimeSuffix } = req.body
        // if the config option have preset and outputformat, and body have't will auto replace
        if (!preset && this.config.preset) preset = this.config.preset
        if (!outputformat && this.config.outputformat) outputformat = this.config.outputformat
        url = Utils.getRealUrl(url)
        if (!url) {
            res.send({ code: 1, message: 'please check params' })
        } else {
            try {
                const isMultiple = Array.isArray(url)
                // 如果url是逗号分隔的多个链接处理
                if (isMultiple) {
                    for (const urlItem of url) {
                        // eslint-disable-next-line max-len
                        this.createDownloadMission({ url: urlItem, dir, preset, enableTimeSuffix: enableTimeSuffix ?? false, useragent, outputformat }).then(() => {
                            Utils.LOG.info('download mission created:' + urlItem)
                        }).catch((e) => {
                            Utils.LOG.warn('download mission create failed:' + e)
                        })
                    }
                } else {
                    this.createDownloadMission({ 
                        name, 
                        url,
                        dir,
                        preset,
                        enableTimeSuffix: enableTimeSuffix ?? false,
                        useragent,
                        outputformat, 
                    }).then(() => {
                        Utils.LOG.info('download mission created:' + url)
                    }).catch((e) => {
                        Utils.LOG.warn('download mission create failed:' + e)
                    })
                }
                res.send({ code: 0, message: `${name} video download mission create success` })
            } catch (e) {
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // get download list
    app.get('/list', async (req, res) => {
        const { current, pageSize, status } = req.query
        try {
            const list = await this.dbOperation.queryByPage({
                pageNumber: current, pageSize, status, sortField: 'crt_tm', sortOrder: 'ASC',
            })
            res.send({ code: 0, data: list })
        } catch (e) {
            Utils.LOG.error(e)
            res.send({ code: 1, message: String(e) })
        }
    })
    // pause download
    app.get('/pause', async (req, res) => {
        const { uid } = req.query
        if (!uid) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            try {
                await this.pauseMission(uid)
                res.send({ code: 0 })
            } catch (e) {
                Utils.LOG.error(e)
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // pause download
    app.get('/resume', async (req, res) => {
        const { uid } = req.query
        if (!uid) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            try {
                await this.resumeDownload(uid)
                res.send({ code: 0 })
            } catch (e) {
                Utils.LOG.error(e)
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // delete mission
    app.delete('/del', async (req, res) => {
        let uid = req.query?.uid
        if (uid && uid.indexOf(',')) {
            uid = uid.split(',')
        }
        if (!uid || uid === undefined) {
            res.send({ code: 1, message: 'please provide a valid  uid' })
        } else {
            try {
                await this.deleteDownload(uid)
                res.send({ code: 0, message: 'delete mission success' })
            } catch (e) {
                Utils.LOG.error(e)
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // stop mission
    app.post('/stop', async (req, res) => {
        const uid = req.query?.uid
        if (!uid || uid === undefined) {
            res.send({ code: 1, message: 'please provide a valid  uid' })
        } else {
            try {
                await this.stopDownload(uid)
                res.send({ code: 0, message: 'stop mission success' })
            } catch (e) {
                Utils.LOG.error(e)
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    app.get('/dir', async (req, res) => {
        try {
            const dirs = await Utils.getDirectories(
                path.join(process.cwd(), this.config.downloadDir), 
                this.config.downloadDir,
            )
            dirs.unshift({
                label: '/media/',
                value: '/media/',

            })
            res.send({ code: 0, data: dirs })
        } catch (e) {
            Utils.LOG.error(e)
            res.send({ code: 1, message: 'system error' })
        }
    })
    // parser url
    app.get('/parser', async (req, res) => {
        const url = req.query.url
        if (!url || url === undefined) {
            res.send({ code: 1, message: 'please provide a valid  url' })
        } else {
            try {
                const realUrl = await this.parserUrl(url)
                res.send({ code: 0, data: realUrl })
            } catch (e) {
                res.send({ code: 1, message: 'system error' })
            }
        }
    })
    app.listen(port, async () => {
        // initial front end resouce
        try {
            await initializeFrontEnd()
        } catch (e) {
            // download frontend static file error;
            console.warn(colors.red(e));
            process.exit(0)

        }
        const list = await getNetwork()
        const listenString = list.reduce((pre, val) => {
            return pre + `\n ${colors.white('   -')} ${colors.brightCyan('http://' + val + ':' + port + '/')}`
        }, colors.white('[ffandown] server running at:\n'))
        const isWorker = cluster.isWorker
        if (isWorker && cluster.worker.id === 1 || !isWorker) {
            console.log(colors.green(listenString))
        }
    })
}

module.exports = createServer