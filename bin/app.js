/** express server */
const express = require('express')
const cluster = require('cluster')
const path = require('path')
const colors = require('colors')
const bodyParser = require('body-parser')
const app = express()
app.use(express.static(path.join(__dirname, '../public')))
const jsonParser = bodyParser.json()

/**
 * @description
 * @param {FFandown} this
 */
function createServer () {
    const port = this.option.port
    app.post('/down', jsonParser, (req, res) => {
        const { name, url } = req.body
        if (!url) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            if (!url) {
                res.send('{"code": 2, "message":"url cant be null"}')
            } else {
                try {
                    this.startDownload(url, name)
                    res.send({ code: 0, message: `${name}.mp4 is download !!!!` })
                } catch (e) {
                    res.send({ code: 1, message: String(e) })
                }
            }
        }
    })
    app.get('/update', async (req, res) => {
        try {
            const update = await this.update.getUpdate()
            res.send({ code: 0, data: update })
        } catch (err) {
            res.end({ code: 1, message: 'get update failed' })
        }
    })
    app.get('/list', async (req, res) => {
        const list = await this.db.SysDownload.getAll()
        res.send({ code: 0, data: list })
    })
    app.delete('/del', async (req, res) => {
        const { uid } = req.query
        if (!uid) {
            res.send({ code: 1, message: 'uid is required' })
        } else {
            const result = await this.db.SysDownload.delete(uid) 
            res.send({ code: 0, data: result })
        }
    })
    app.post('/contDownload', jsonParser, async (req, res) => {
        const { name, url, timemark } = req.body
        if (!url || !timemark) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            try {
                this.startDownload(url, name, timemark)
                res.send({ code: 0, message: `${name}.mp4 is continue download` })
            } catch (e) {
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    app.get('/parser', async (req, res) => {
        const url = req.query.url
        if (!url) {
            res.send({ code: 1, message: '' })
        } else {
            const realUrl = await this.pluginParser(url)
            console.log(realUrl, url)
            res.send({ code: 0, data: realUrl })
        }
    })
    app.listen(port, async () => {
        const list = await this.system.getNetwork()
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