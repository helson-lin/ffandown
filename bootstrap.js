const createServer = require('./bin/app.js')
const cluster = require('cluster')
const figlet = require('figlet')
const colors = require('colors')
const Utils = require('./bin/utils/index')
const Oimi = require('./bin/index.js')
const config = Utils.readConfig()

// 添加进程未捕获异常的处理
process.on('uncaughtException', (err) => {
    Utils.LOG.error(`uncaughtException: ${err.message}`)
    Utils.LOG.error(err.stack)
    console.error(colors.red(`[Fatal Error] uncaught exception: ${err.message}`))
})

process.on('unhandledRejection', (reason) => {
    Utils.LOG.error(`Unprocessed Promise Rejected: ${reason}`)
    console.error(colors.red(`[Fatal Error] Unprocessed Promise Rejected: ${reason}`))
})

console.log(colors.blue(figlet.textSync(`FFandown ${Utils.SYSYTEM_VERSION}`, 'Small Slant')))

const oimi = new Oimi(
    config.downloadDir, 
    { 
        thread: config.thread, 
        maxDownloadNum: config.maxDownloadNum, 
        enableTimeSuffix: config.enableTimeSuffix || false,
        autoInstallFFmpeg: config.autoInstallFFmpeg || false,
    },
)
// 设置日志级别
Utils.LOG.level = process.env.DEBUG ? 'debug' : 'info'

// 设置 oimi 配置
Oimi.prototype.config = config

// oimi 服务启动之后创建接口服务
oimi.ready().then(async () => {
    if (config?.proxy) await Utils.setProxy(config.proxy)
    createServer({
        oimi, 
        port: config.port,
    })
}).catch(err => {
    Utils.LOG.error(`Oimi Server startup failed: ${err.message}`)
    Utils.LOG.error(err.stack)
    console.error(colors.red(`[ffandown] Service startup failed: ${err.message}`))
    process.exit(1)
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
    console.log('\n[ffandown] Server stop')
})