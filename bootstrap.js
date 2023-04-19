const createServer = require('./bin/app.js')
const { setFfmpegEnv, setProxy, readConfig, ffmpegKiller } = require('./bin/utils/index')
const cluster = require('cluster')
const os = require('os')
const colors = require('colors')
const process = require('process')
const cpuNum = os.cpus().length
// read local config options
const option = readConfig()
setProxy(option.proxyUrl)
/**
 * Description create cluster
 * @date 3/14/2023 - 5:33:53 PM
 * @async
 * @returns {void}
 */
const createCluster = async () => {
    if (option.useFFmpegLib) {
        await setFfmpegEnv()
    } 
    for (let i = 0; i < cpuNum; i++) {
        process.nextTick(() => cluster.fork())
    }
    cluster.on('exit', (worker, code, signal) => {
        console.log(colors.red(`worker ${worker.process.pid} died, code: ${code}, signal: ${signal}`))
        cluster.fork()
    })
}

/**
 * Description thread running
 * @date 3/14/2023 - 5:33:01 PM
 * @async
 * @returns {void}
 */
const threadRun = async () => {
    if (cluster.isMaster) {
        console.log(colors.blue(`Master ${process.pid} is running`))
        ffmpegKiller.killToDeathFfmeg()
        await createCluster()
    } else {
        createServer(option)
    }
}
/**
 * Description start server
 * @date 3/14/2023 - 5:33:01 PM
 * @async
 * @returns {void}
 */
(async () => {
    if (option.thread) {
        await threadRun()
    } else {
        if (option.useFFmpegLib) {
            await setFfmpegEnv()
        } 
        createServer(option)
        ffmpegKiller.killToDeathFfmeg()
    }
})()

process.on('SIGINT', function () {
    if (cluster.isMaster) {
        ffmpegKiller.clear()
        console.log('\n Pressed Control-C to exit.')
        process.exit(0)    
    } 
})