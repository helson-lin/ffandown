const createServer = require('./bin/app.js')
const FFandown = require('./bin/core/index.js')
const cluster = require('cluster')
const os = require('os')
const colors = require('colors')
const process = require('process')
const { v4: uuidv4 } = require('uuid')
const cpuNum = os.cpus().length
const ffandown = new FFandown()
console.log(uuidv4())
/**
 * Description create cluster
 * @date 3/14/2023 - 5:33:53 PM
 * @async
 * @returns {void}
 */
const createCluster = async () => {
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
        await createCluster()
    } else {
        ffandown.addReadyHooks(createServer)
    }
}
/**
 * Description start server
 * @date 3/14/2023 - 5:33:01 PM
 * @async
 * @returns {void}
 */
(async () => {
    if (ffandown.option.thread) {
        await threadRun()
    } else {
        ffandown.addReadyHooks(createServer)
    }
})()

process.on('SIGINT', function () {
    if (cluster.isMaster) {
        console.log('\n Pressed Control-C to exit.')
        process.exit(0)
    }
})