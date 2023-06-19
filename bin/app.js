/** express server */
const express = require('express')
const cluster = require('cluster')
const path = require('path')
const colors = require('colors')
const bodyParser = require('body-parser')
const logger = require('./log')
const UPDATE = require('./utils/checkUpdate')
const app = express()
const { download, getNetwork, isSupportedUrl } = require('./utils/index')

app.use(express.static(path.join(__dirname, '../public')))
const jsonParser = bodyParser.json()

const createServer = (option) => {
    app.post('/down', jsonParser, (req, res) => {
        const { name, url } = req.body
        // check params
        if (!url) {
            res.send({ code: 0, message: 'please check params' })
        } else {
            // pass check
            if (!url) {
                res.send('{"code": 2, "message":"url cant be null"}')
            } else {
                try {
                    res.send({ code: 0, message: `${name}.mp4 is download !!!!` })
                    // to download
                    const urlList = url.indexOf(",") === -1 ? url : url.split(",").filter(i => isSupportedUrl(i))
                    const isArray = urlList instanceof Array
                    if (!isArray) {
                        const filename = name || new Date().getTime()
                        const filePath = path.join(option.downloadDir, filename + '.mp4')
                        logger.info(`online m3u8 url: ${url}, file download path:  ${filePath}`)
                        download(url, name, filePath, option).then(res => {
                            logger.info(`${name}.mp4 is finish !!!!`)
                        }).catch(err => {
                            logger.info(`${name}.mp4, ${String(err)}`)
                        })
                    } else {
                        const urlPromiseList = urlList.map((url, index) => {
                            const filename = name ? `${name}-${index+1}` : `${new Date().getTime()}-${index+1}`
                            const filePath = path.join(option.downloadDir, filename + '.mp4')
                            return download(url, filename, filePath, option)
                        })
                        Promise.allSettled(urlPromiseList).then((result) => {
                            logger.info('download success')
                            // const successList = result.filter(item => item.status === 'fullfilled')
                            // successList.forEach(sucesss => console.log(sucesss))
                        })
                    }
                } catch (e) {
                    logger.info(`${name}.mp4, ${String(e)}`)
                    res.send({ code: 1, message: String(e) })
                }
            }
        }
    })
    app.get('/update', async (req, res) => {
        try {
            const update = await UPDATE.getUpdate()
            res.send({ code: 0, data: update })
        } catch (err) {
            res.end({ code: 1, message: 'get update failed' })
        }
    })
    app.listen(option.port, async () => {
        const list = await getNetwork()
        const listenString = list.reduce((pre, val) => {
            return pre + `\n ${colors.white('   -')} ${colors.brightCyan('http://' + val + ':' + option.port + '/')}`
        }, colors.white('[ffandown] server running at:\n'))
        logger.info('[ffandown] server running at port: ' + option.port)
        const isWorker = cluster.isWorker
        if (isWorker && cluster.worker.id === 1 || !isWorker) {
            console.log(colors.green(listenString))
        }
    })
}

module.exports = createServer