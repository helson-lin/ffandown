const createServer = require('./bin/app.js')
const { setFfmpegEnv, readConfig } = require('./bin/utils.js')
const cluster = require('cluster')
const os = require('os')
const colors = require('colors')
const cpuNum = os.cpus().length
// read local config options
const option = readConfig()
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
        cluster.fork()
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
    }
})()