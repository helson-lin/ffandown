const createServer = require('./bin/app.js')
const cluster = require('cluster')
const Utils = require('./bin/utils/index')
const Oimi = require('oimi-helper')
const config = Utils.readConfig()
const figlet = require('figlet')
const oimi = new Oimi(config.downloadDir)

console.log(figlet.textSync("ffandown"))
oimi.ready().then(() => {
    createServer.call(oimi, config.port)
})
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