const path = require('path')
const fetch = require('node-fetch')
const m3u8ToMp4 = require('./m3u8')
const message = require('../utils/message')
const config = require('../utils/config')
const update = require('./checkUpdate')
const system = require('../utils/system')
const db = require('./db')
const logger = require('./log')
const helper = require('../utils/helper')
const plugins = require('../plugins')
const { v4: uuidv4 } = require('uuid')

class FFandown {
    constructor () {
        this.uuid = uuidv4()
        this.fetch = fetch
        this.readyList = []
        this.downloadList = []
        this.plugins = plugins
        this.db = db
        this.option = this.config.readConfig()
    }

    create () {
        this.lifecyle()
    }

    /**
     * @description lifecyle function
     */
    async lifecyle () {
        this.beforeReady()
        await this.helper
        .setTypes(this.option.useFFmpegLib, this.option.useFFmpegLib)
        .downloadFfbinaries()
        // await this.helper.setProxy()
        this.readyHooks()
    }

    /**
     * @description beforeReady lifecyle
     */
    beforeReady () {
        this.db.sync()
        // insrt plugins
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
        return this
    }

    pluginParser (url) {
        const parserPlugin = this.plugins.find(plugin => plugin.match(url))
        if (!parserPlugin) return url
        return parserPlugin.parser(url)
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
    async createRecord (url, filePath) {
        const uid = uuidv4()
        const name = filePath.split('/').pop()
        await this.db.SysDownload.create({
            uid,
            name,
            url,
            percent: 0,
            status: '0',
            filePath,
        })
        this.downloadList.push({
            uid,
            url,
            filePath,
            percent: null,
        })
        // set percent value
        return uid
    }

    /**
     * @description  async data from db with memeory
     * @param {*} uid 
     */
    async syncDownloadRecordWidthDb (uid) {}

    /**
     * @description set file download percent
     * @param {string} uid unique identifier
     * @param {string} val percent value
     */
    async setDownloadStatus (uid, params) {
        const item = this.downloadList.find(i => i.uid === uid)
        if (item) {
            // update download percent
            item.percent = params.percent
            const downloadMission = {
                percent: params.percent,
                speed: params.currentMbs,
                targetSize: params.targetSize,
                timemark: params.timemark,
            }
            if (params.percent === 100) {
                downloadMission.status = '3'
            }
            await this.db.SysDownload.update(uid, downloadMission)
        }
    }

    /**
     * @description download
     * @param {string} url 
     * @param {string} filePath 
     * @returns 
     */
    async download (url, filePath) {
        const cpuNums = this.system.getCpuNum()
        const threads = this.option?.downloadThread ? cpuNums : 0
        const converter = new m3u8ToMp4()
        const uid = await this.createRecord(url, filePath)
        return new Promise((resolve, reject) => {
            converter
            .setInputFile(url)
            .setThreads(threads)
            .setOutputFile(filePath)
            .start((params) => {
                this.setDownloadStatus(uid, params)
            })
            .then(() => {
                resolve()
            }).catch(err => {
                reject(err)
            })
        })
    }

    async contDownload (uid, url, filePath, timemark) {
        const cpuNums = this.system.getCpuNum()
        const threads = this.option?.downloadThread ? cpuNums : 0
        const converter = new m3u8ToMp4()
        return new Promise((resolve, reject) => {
            converter
            .setInputFile(url)
            .setThreads(threads)
            .setTimeMark(timemark)
            .setOutputFile(filePath)
            .start((params) => {
                this.setDownloadStatus(uid, params)
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
    async startDownload (url, name, timemark) {
        // do plugins download
        // const realUrl = await this.pluginParser(url)
        // console.log(realUrl)
        const filePath = this.getDownloadFilePath(name)
        this.logger.info(`online m3u8 url: ${url}, \n file download path:  ${filePath}`)
        const { webhooks, webhookType } = this.option
        this.download(url, filePath, timemark)
        .then(() => {
            this.logger.info(`${name}.mp4 下载成功`)
            this.msg(webhooks, webhookType, `${name}.mp4 下载成功`)
            .then((msg) => this.logger.info(msg))
            .catch(e => this.logger.warn(e))
        }).catch((e) => {
            console.log(e)
            this.logger.info(`${name}.mp4 下载失败`)
            this.msg(webhooks, webhookType, `${name}.mp4 下载失败`, String(e).trim())
            .then((msg) => this.logger.info(msg))
            .catch(e => this.logger.warn(e))
        })
    }
}

const getInstance = () => {
    let instance
    return (() => {
        if (!instance) {
            instance = new FFandown()
        }
        return instance
    })()
}

FFandown.prototype.helper = helper
FFandown.prototype.system = system
FFandown.prototype.msg = message.msg
FFandown.prototype.config = config
FFandown.prototype.update = update
FFandown.prototype.logger = logger

module.exports = getInstance()