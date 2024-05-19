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
        // TODO: 新增参数dir 实现自动目录
        // 前端页面需要可以获取目录地址
        const { name, url, preset, outputformat, useragent, dir } = req.body
        console.log(req.body, 'query')
        if (!url) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            if (!url) {
                res.send('{"code": 2, "message":"url cant be null"}')
            } else {
                try {
                    const isMultiple = url.indexOf(',') !== -1 // 多个链接处理
                    // 如果url是逗号分隔的多个链接处理
                    if (isMultiple) {
                        const urls = url.split(',')
                        for (const urlItem of urls) {
                            // eslint-disable-next-line max-len
                            this.createDownloadMission({ url: urlItem, dir, preset, useragent, outputformat }).then(() => {
                                Utils.LOG.info('download success:' + urlItem)
                                Utils.msg(this.config.webhooks, this.config.webhookType, 'ffandown下载成功', `${urlItem}`)
                                .catch(e => {
                                    Utils.LOG.warn('message failed:' + e)
                                })
                            }).catch((e) => {
                                Utils.LOG.warn('download failed:' + e)
                                // eslint-disable-next-line max-len
                                Utils.msg(this.config.webhooks, this.config.webhookType, 'ffandown下载失败', `${urlItem}: ${e}`)
                                .catch(e => {
                                    Utils.LOG.warn('message failed:' + e)
                                })
                            })
                        }
                    } else {
                        this.createDownloadMission({ 
                            name, 
                            url,
                            dir,
                            preset,
                            useragent,
                            outputformat, 
                        }).then(() => {
                            Utils.LOG.info('download success:' + url)
                            Utils.msg(this.config.webhooks, this.config.webhookType, 'ffandown下载成功', `${url}`)
                            .catch(e => {
                                Utils.LOG.warn('message failed:' + e)
                            })
                        }).catch((e) => {
                            Utils.LOG.warn('download failed:' + e)
                            Utils.msg(this.config.webhooks, this.config.webhookType, 'ffandown下载失败', `${url}: ${e}`)
                            .catch(e => {
                                Utils.LOG.warn('message failed:' + e)
                            })
                        })
                    }
                    res.send({ code: 0, message: `${name}.mp4 is download !!!!` })
                } catch (e) {
                    res.send({ code: 1, message: String(e) })
                }
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
                await this.dbOperation.batchDelete(uid)
                res.send({ code: 0, message: 'delete mission' })
            } catch (e) {
                Utils.LOG.error(e)
                res.send({ code: 1, message: 'system error' })
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
        await initializeFrontEnd()
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