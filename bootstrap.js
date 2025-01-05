const createServer = require('./bin/app.js')
const cluster = require('cluster')
const Utils = require('./bin/utils/index')
const Oimi = require('./bin/index.js')
const config = Utils.readConfig()
const figlet = require('figlet')
const colors = require('colors')

console.log(colors.blue(figlet.textSync('ffandown', 'ANSI Shadow')))
const oimi = new Oimi(
    config.downloadDir, 
    { 
        thread: config.thread, 
        verbose: process.env.DEBUG || false, 
        maxDownloadNum: config.maxDownloadNum, 
        enableTimeSuffix: config.enableTimeSuffix || false,
    },
)
Oimi.prototype.config = config

oimi.ready().then(() => {
    createServer({
        oimi, 
        port: config.port,
    })
})

process.on('SIGTERM', async () => {
    await oimi.killAll()
    process.exit(1)
})

process.on('SIGINT', async function () {
    if (cluster.isMaster) {
        await oimi.killAll()
        process.exit(0)
    }
})

process.on('exit', async () => {
    // 退出之前，杀掉进程
    await oimi.killAll()
    console.log('\n Server stop')
})