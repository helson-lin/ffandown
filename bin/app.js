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
app.use(express.static(path.join(__dirname, '../public')))
/**
 * @description
 * @param {FFandown} this
 */
function createServer (port) {
    ws(app).getWss('/')

    const { getNetwork } = Utils
    app.ws('/ws', (ws, req) => {
        // console.log('连接成功！')
        // wss.push(ws)
        ws.send(Utils.sendWsMsg('connected'))
        // send给客户端发消息
        // on是监听事件
        // message表示服务端传来的数据
        ws.on('message', async (msg) => {
            try {
                const data = JSON.parse(msg)
                const { key } = data
                if (key === 'list') {
                    const list = await this.dbOperation.getAll()
                    ws.send(Utils.sendWsMsg(list, 'list'))
                }
            } catch (e) {
                console.error(e)
            }
        })
        // close 事件表示客户端断开连接时执行的回调函数 
        ws.on('close', function (e) {
            console.log('close connection')
        })
    })
    app.post('/down', jsonParser, (req, res) => {
        const { name, url, preset, outputformat } = req.body
        if (!url) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            if (!url) {
                res.send('{"code": 2, "message":"url cant be null"}')
            } else {
                try {
                    this.createDownloadMission({ name, url, preset, outputformat }).then(() => {
                        console.log('下载成功', this.config)
                        Utils.msg(this.config.webhooks, this.config.webhookType, 'ffandown下载成功', `${url}`)
                    }).catch((e) => {
                        console.log('download failed：' + e)
                        Utils.msg(this.config.webhooks, this.config.webhookType, 'ffandown下载失败', `${url}: ${e}`)
                    },
                    )
                    res.send({ code: 0, message: `${name}.mp4 is download !!!!` })
                } catch (e) {
                    res.send({ code: 1, message: String(e) })
                }
            }
        }
    })
    app.post('/contDownload', jsonParser, async (req, res) => {
        const { uid, name } = req.body
        if (!uid) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            try {
                // continue download
                this.resumeDownload(uid)
                res.send({ code: 0, message: `${name}.mp4 is continue download` })
            } catch (e) {
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    app.get('/list', async (req, res) => {
        try {
            const list = await this.dbOperation.getAll()
            res.send({ code: 0, data: list })
        } catch (e) {
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
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // delete mission
    app.delete('/del', async (req, res) => {
        let uid = req.query.uid
        if (uid.indexOf(',')) {
            uid = uid.split(',')
        }
        if (!uid || uid === undefined) {
            res.send({ code: 1, message: 'please provide a valid  uid' })
        } else {
            try {
                if (uid instanceof Array) {
                    for (let uidItem of uid) {
                        // 同步删除文件
                        await this.deleteMission(uidItem)
                    }
                } else {
                    await this.deleteMission(uid)
                }
                res.send({ code: 0, message: 'delete mission' })
            } catch (e) {
                res.send({ code: 2, message: 'system error' })
            }
        }
    })
    app.get('/parser', async (req, res) => {
        const url = req.query.url
        if (!url || url === undefined) {
            res.send({ code: 1, message: 'please provide a valid  url' })
        } else {
            try {
                const realUrl = await this.parserUrl(url)
                res.send({ code: 0, data: realUrl })
            } catch (e) {
                console.log(e)
                res.send({ code: 2, message: 'system error' })
            }
        }
    })
    app.listen(port, async () => {
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