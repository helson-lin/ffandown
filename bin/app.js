/** express server */
const express = require('express')
const cluster = require('cluster')
const path = require('path')
const colors = require('colors')
const bodyParser = require('body-parser')
const app = express()

app.use(express.static(path.join(__dirname, '../public')))

const jsonParser = bodyParser.json()
const isSupportedUrl = (url) => url.startsWith('rtmp://') || url.startsWith('rtsp://') || url.endsWith('.m3u8')

function createServer () {
    const port = this.option.port
    app.post('/down', jsonParser, (req, res) => {
        const { name, url } = req.body
        if (!url || !isSupportedUrl(url)) {
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