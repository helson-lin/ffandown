const createServer = require('./bin/app.js')
const ffandown = require('./bin/core/index.js')
const cluster = require('cluster')
const process = require('process')
/**
 * Description start server
 * @date 3/14/2023 - 5:33:01 PM
 * @async
 * @returns {void}
 */
const startServer = () => {
    ffandown
    .addReadyHooks(createServer) // add ready hooks
    .create() // create server
}

startServer()

process.on('SIGTERM', async () => {
    process.exit(1)
})

process.on('SIGINT', function () {
    if (cluster.isMaster) {
        console.log('\n Pressed Control-C to exit. \n')
        process.exit(0)
    }
})
process.on('exit', () => {
    console.log('\n Server stop')
})