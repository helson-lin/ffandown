/** express server */
const express = require('express')
const ws = require('express-ws')
const i18n = require('i18n')
const cluster = require('cluster')
const path = require('path')
const colors = require('colors')
const bodyParser = require('body-parser')
const app = express()
const Utils = require('./utils/index')
const jsonParser = bodyParser.json()
const Oimi = require('./index')

// i18n
i18n.configure({
    locales: ['en', 'zh'], // 声明包含语言
    directory: path.join(__dirname, '../locales'), // 设置语言文件目录
    header: 'accept-language',
    defaultLocale: 'zh', // 设置默认语言
})
app.use(i18n.init)
// express static server
app.use(express.static(path.join(process.cwd(), 'public')))
/**
 * @description
 * @param port
 */
function createServer (port) {
    ws(app).getWss('/')

    const { getNetwork, initializeFrontEnd, modifyYml } = Utils

    // registerEventCallback
    this.registerEventCallback((data) => {
        const { name, status } = data
        const isSuccess = status === '3'
        Utils.msg(
            this.config.webhooks,
            this.config.webhookType,
            i18n.__('test_title'),
            `${name}: ${isSuccess ? i18n.__('download_success') : `${i18n.__('download_failed')}:\n ${data?.message}`}`,
        )
        .then(() => Utils.LOG.warn(i18n.__('send_success')))
        .catch(e => {
            Utils.LOG.warn(`${i18n.__('send_failed')}:  ${String(e)}`)
        })
    })
    // websocket
    app.ws('/ws', (ws) => {
        ws.send(Utils.sendWsMsg('connected'))
        ws.on('message', async (msg) => {
            try {
                const data = JSON.parse(msg)
                const { key } = data
                if (key === 'list') {
                    const list = await this.dbOperation.getAll()
                    ws.send(Utils.sendWsMsg(list, 'list'))
                } else if(key === 'page') {
                    const { current, pageSize, status } = data
                    const list = await this.dbOperation.queryByPage({
                        pageNumber: current, pageSize, status, sortField: 'crt_tm', sortOrder: 'ASC',
                    })
                    ws.send(Utils.sendWsMsg(list, 'page'))
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
        res.send({ code: 0, message: res.__('update_success') })
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
            res.send({ code: 0, message: res.__('update_success') })
        } catch (e) {
            res.send({ code: 1, message: e.message })
        }
    })
    // create download mission
    app.post('/down', jsonParser, (req, res) => {
        let { name, url, preset, outputformat, useragent, dir, enableTimeSuffix } = req.body
        // if the config option have preset and outputformat, and body haven't willed auto replace
        if (!preset && this.config.preset) preset = this.config.preset
        if (!outputformat && this.config.outputformat) outputformat = this.config.outputformat
        url = Utils.getRealUrl(url)
        if (!url) {
            res.send({ code: 1, message: res.__('query_error') })
        } else {
            try {
                const isMultiple = Array.isArray(url)
                // 如果url是逗号分隔的多个链接处理
                if (isMultiple) {
                    for (const urlItem of url) {
                        // eslint-disable-next-line max-len
                        this.createDownloadMission({ url: urlItem, dir, preset, enableTimeSuffix: enableTimeSuffix ?? false, useragent, outputformat }).then(() => {
                            Utils.LOG.info(`${i18n.__('create_success')}: ${urlItem}` )
                        }).catch((e) => {
                            Utils.LOG.warn(`${i18n.__('create_failed')}: ${String(e)}` )
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
                        Utils.LOG.info(`${i18n.__('create_success')}: ${url}` )
                    }).catch((e) => {
                        Utils.LOG.warn(`${i18n.__('create_failed')}: ${String(e)}` )
                    })
                }
                res.send({ code: 0, message: `${name} ${res.__('create_success')}` })
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
            res.send({ code: 0, message: res.__('query_error') })
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
            res.send({ code: 0, message: res.__('query_error') })
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
            res.send({ code: 1, message: res.__('uid_required') })
        } else {
            try {
                await this.deleteDownload(uid)
                res.send({ code: 0, message: res.__('delete_success') })
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
            res.send({ code: 1, message: res.__('uid_required') })
        } else {
            try {
                await this.stopDownload(uid)
                res.send({ code: 0, message: res.__('stop_success') })
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
            res.send({ code: 1, message: res.__('system_error') })
        }
    })
    // parser url
    app.get('/parser', async (req, res) => {
        const url = req.query.url
        if (!url || url === undefined) {
            res.send({ code: 1, message: res.__('uid_required') })
        } else {
            try {
                const realUrl = await this.parserUrl(url)
                res.send({ code: 0, data: realUrl })
            } catch (e) {
                res.send({ code: 1, message: res.__('system_error') })
            }
        }
    })
    app.get('/testWebhook', async (req, res) => {
        const { webhookType, webhooks } = req.query
        try {
            Utils.msg(webhooks, webhookType, i18n.__('test_title'), i18n.__('test_notification'))
            .then(() => {
                res.send({ code: 0, message: 'success' })
            })
            .catch(e => {
                res.send({ code: 1, message: e })
            })
        } catch (e) {
            res.send({ code: 1, message: e })
        }
    })
    app.listen(port, async () => {
        // initial front end resouce
        try {
            await initializeFrontEnd()
        } catch (e) {
            // download frontend static file error;
            console.warn(colors.red(e))
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