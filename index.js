const createServer = require('./bin/app.js')
const { setFfmpegEnv, readConfig } = require("./bin/utils.js")
const cluster = require('cluster');
const os = require("os")
const colors = require('colors');
const cpuNum = os.cpus().length

const option = readConfig()

const threadRun = () => {
    if (cluster.isMaster) {
        console.log(colors.blue(`Master ${process.pid} is running`));
        for (let i = 0; i < cpuNum; i++) {
            cluster.fork();
        }
        cluster.on('exit', (worker, code, signal) => {
            console.log(colors.red(`worker ${worker.process.pid} died, code: ${code}, signal: ${signal}`));
            cluster.fork();
        });
    } else {
        createServer(option)
    }
}

(async () => {
    if (option.useFFmpegLib) {
        await setFfmpegEnv()
    } 
    if (option.thread) {
        threadRun()
    } else {
        createServer(option)
    }
})()