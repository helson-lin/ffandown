/** express server */
const express = require('express')
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
    const { getNetwork } = Utils
    app.post('/down', jsonParser, (req, res) => {
        const { name, url } = req.body
        if (!url) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            if (!url) {
                res.send('{"code": 2, "message":"url cant be null"}')
            } else {
                try {
                    this.createDownloadMission({ name, url }).then(() => {
                        console.log('下载成功')
                    }).catch(e =>
                        console.log('download failed：' + e),
                    )
                    res.send({ code: 0, message: `${name}.mp4 is download !!!!` })
                } catch (e) {
                    res.send({ code: 1, message: String(e) })
                }
            }
        }
    })
    app.post('/contDownload', jsonParser, async (req, res) => {
        const { name, url, timemark } = req.body
        if (!url || !timemark) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            try {
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
    // delete mission
    app.delete('/del', async (req, res) => {
        const uid = req.query.uid
        if (!uid || uid === undefined) {
            res.send({ code: 1, message: 'please provide a valid  uid' })
        } else {
            try {
                await this.dbOperation.delete(uid)
                // TODO：kill the download process
                res.send({ code: 0, message: 'delete mission' })
            } catch (e) {
                console.log(e)
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