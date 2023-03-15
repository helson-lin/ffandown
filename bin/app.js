/** express server */
const express = require('express')
const cluster = require('cluster')
const path = require('path')
const colors = require('colors')
const bodyParser = require('body-parser')
const logger = require('./log')
const app = express()
const { download, getNetwork } = require('./utils.js')

app.use(express.static(path.join(__dirname, '../public')))
const jsonParser = bodyParser.json()

const createServer = (option) => {
    app.post('/down', jsonParser, (req, res) => {
        const { name, url } = req.body
        const filePath = path.join(option.downloadDir, (name || new Date().getTime()) + '.mp4')
        logger.info(`file download path:  ${filePath}`)
        if (!url) {
            res.send('{"code": 2, "message":"url cant be null"}')
        } else {
            try {
                res.send(`{"code": 0, "message": "${name}.mp4 is download !!!!"}`)
                download(url, name, filePath, option).then(res => {
                    logger.info(`${name}.mp4 is finish !!!!`)
                    console.log(`${name}.mp4 is finish !!!!`)
                }).catch(err => {
                    logger.info(`${name}.mp4, ${String(err)}`)
                })
            } catch (e) {
                logger.info(`${name}.mp4, ${String(e)}`)
                res.send(`{"code": 1, "message": "${String(e)}"}`)
            }
        }
    })

    app.listen(option.port, async () => {
        const list = await getNetwork()
        const listenString = list.reduce((pre, val) => {
            return pre + `\n ${colors.white('   -')} ${colors.brightCyan('http://' + val + ':' + option.port + '/')}`
        }, colors.white('[ffandown] server running at:\n'))
        logger.info(listenString)
        const isWorker = cluster.isWorker
        if (isWorker && cluster.worker.id === 1 || !isWorker) {
            console.log(colors.green(listenString))
        }
    })
}

module.exports = createServer