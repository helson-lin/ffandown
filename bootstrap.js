const createServer = require('./bin/app.js')
const cluster = require('cluster')
const figlet = require('figlet')
const colors = require('colors')
const Utils = require('./bin/utils/index')
const Oimi = require('./bin/index.js')
const config = Utils.readConfig()

console.log(colors.blue(figlet.textSync('ffandown', 'Small Slant')))

const oimi = new Oimi(
    config.downloadDir, 
    { 
        thread: config.thread, 
        maxDownloadNum: config.maxDownloadNum, 
        enableTimeSuffix: config.enableTimeSuffix || false,
    },
)
// 设置日志级别
Utils.LOG.level = process.env.DEBUG ? 'debug' : 'info'

// 设置 oimi 配置
Oimi.prototype.config = config

// oimi 服务启动之后创建接口服务
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
    console.log('\nServer stop')
})