const m3u8ToMp4 = require('./m3u8')
const message = require('../utils/message')
const config = require('../utils/config')
const update = require('./checkUpdate')
const system = require('../utils/system')
const path = require('path')
const logger = require('./log')
const helper = require('../utils/helper')
const { v4: uuidv4 } = require('uuid')

class FFandown {
    constructor () {
        this.readyList = []
        this.downloadList = []
        this.lifecyle()
    }

    async lifecyle () {
        this.beforeReady()
        await this.helper
        .setTypes(this.option.useFFmpegLib, this.option.useFFmpegLib)
        .downloadFfbinaries()
        await this.helper.setProxy()
        this.readyHooks()
    }

    /**
     * @description beforeReady lifecyle
     */
    beforeReady () {
        this.option = this.config.readConfig()
    }

    /**
     * @description ffandown is ready
     */
    readyHooks () {
        this.readyList.forEach(func => func.call(this))
    }

    /**
     * @description add ready hooks to lifecyle
     * @param {Function} func 
     */
    addReadyHooks (func) {
        if (func && typeof func === 'function') {
            this.readyList.push(func)
        }
    }

    /**
     * @description get file download path by name
     * @param {string} name 
     * @returns {string} path
     */
    getDownloadFilePath (name) {
        return path.join(this.option.downloadDir, (name || new Date().getTime()) + '.mp4')
    }

    /**
     * @description 创建下载记录
     * @param {*} url 
     * @param {*} filePath 
     */
    createRecord (url, filePath) {
        const uid = uuidv4()
        this.downloadList.push({
            uid,
            url,
            filePath,
            percent: null,
        })
        return uid
    }

    setPrecent (uid, val) {
        const item = this.downloadList.find(i => i.uid === uid)
        if (item) {
            item.percent = val
        }
        console.log(this.downloadList)
    }

    /**
     * @description download
     * @param {string} url 
     * @param {string} filePath 
     * @returns 
     */
    download (url, filePath) {
        const cpuNums = this.system.getCpuNum()
        const threads = this.option?.downloadThread ? cpuNums : 0
        const converter = new m3u8ToMp4()
        const uid = this.createRecord(url, filePath)
        return new Promise((resolve, reject) => {
            converter
            .setInputFile(url)
            .setThreads(threads)
            .setOutputFile(filePath)
            .start((params) => {
                // console.log(`percent: ${params.percent}%`)
                this.setPrecent(uid, params.percent)
            })
            .then(() => {
                resolve()
            }).catch(err => {
                reject(err)
            })
        })
    }

    /**
     * @description start download file
     * @param {string} url 
     * @param {string} name 
     */
    async startDownload (url, name) {
        const filePath = this.getDownloadFilePath(name)
        this.logger.info(`online m3u8 url: ${url}, \n file download path:  ${filePath}`)
        const { webhooks, webhookType } = this.option
        this.download(url, filePath)
        .then(() => {
            this.logger.info(`${name}.mp4 下载成功`)
            this.msg(webhooks, webhookType, `${name}.mp4 下载成功`)
            .then((msg) => this.logger.info(msg))
            .catch(e => this.logger.warn(e))
        }).catch((e) => {
            this.logger.info(`${name}.mp4 下载失败`)
            this.msg(webhooks, webhookType, `${name}.mp4 下载失败`, String(e).trim())
            .then((msg) => this.logger.info(msg))
            .catch(e => this.logger.warn(e))
        })
    }
}

FFandown.prototype.helper = helper
FFandown.prototype.system = system
FFandown.prototype.msg = message.msg
FFandown.prototype.config = config
FFandown.prototype.update = update
FFandown.prototype.logger = logger

module.exports = FFandown