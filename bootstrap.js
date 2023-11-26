const createServer = require('./bin/app.js')
const cluster = require('cluster')
const Utils = require('./bin/utils/index')
const Oimi = require('oimi-helper')
const config = Utils.readConfig()
const figlet = require('figlet')
const colors = require('colors')
const oimi = new Oimi(config.downloadDir)
Oimi.prototype.config = config
console.log(colors.blue(figlet.textSync('ffandown', 'ANSI Shadow')))
oimi.ready().then(() => {
    // download latest front package
    createServer.call(oimi, config.port)
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
    await oimi.killAll()
    console.log('\n Server stop')
})