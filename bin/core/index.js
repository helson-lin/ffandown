const m3u8ToMp4 = require('./m3u8')
const message = require('../utils/message')
const config = require('../utils/config')
const update = require('./checkUpdate')
const system = require('../utils/system')
const env = require('../utils/env')
const path = require('path')
const logger = require('./log')

class FFandown {
    constructor() {
        this.readyList = []
        this.option = this.config.readConfig();
        this.beforeHooks()
    }
    async beforeHooks() {
        await this.env.setFfmpegEnv()
        await this.env.setProxy()
        this.readyHooks()
    }

    readyHooks() {
        this.readyList.forEach(func => func.call(this))
    }

    addReadyHooks(func) {
        if (func && typeof func === 'function') {
            this.readyList.push(func);
        }
    }

    getDownloadFilePath(name) {
        return path.join(this.option.downloadDir, (name || new Date().getTime()) + '.mp4')
    }

    download(url, filePath) {
        const cpuNums = this.system.getCpuNum()
        const threads = this.option?.downloadThread ? cpuNums : 0
        return new Promise((resolve, reject) => {
            this.converter
            .setInputFile(url)
            .setThreads(threads)
            .setOutputFile(filePath)
            .start()
            .then(() => {
                resolve()
            }).catch(err => {
                reject(err)
            })
        })
    }

    async startDownload(url, name) {
        const filePath = this.getDownloadFilePath(name)
        this.logger.info(`online m3u8 url: ${url}, \n file download path:  ${filePath}`)
        const { webhooks, webhookType } = this.option
        this.download(url, filePath)
            .then(() => {
                this.logger.info(`${name}.mp4 下载成功`)
                this.msg(webhooks, webhookType, `${name}.mp4 下载成功`).then((msg) => this.logger.info(msg)).catch(e => this.logger.warn(e))
            }).catch((e) => {
                this.logger.info(`${name}.mp4 下载失败`)
                this.msg(webhooks, webhookType, `${name}.mp4 下载失败`, String(e).trim()).then((msg) => this.logger.info(msg)).catch(e => this.logger.warn(e))
            })
    }
}

FFandown.prototype.env = env
FFandown.prototype.system = system
FFandown.prototype.converter = new m3u8ToMp4()
FFandown.prototype.msg = message.msg
FFandown.prototype.config = config
FFandown.prototype.update = update
FFandown.prototype.logger = logger

module.exports = FFandown