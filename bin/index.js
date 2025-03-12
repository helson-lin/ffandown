const FfmpegHelper = require('./core/index')
const { HELPER: helper } = require('./utils/index')
const dbOperation = require('./sql/index')
const path = require('path')
const os = require('os')
const i18n = require('./utils/locale')
const { v4: uuidv4 } = require('uuid')
const { LOG: log } = require('./utils/index')
const { msg } = require('./utils/message')
require('dotenv').config()

class Oimi {
    OUTPUT_DIR
    maxDownloadNum
    thread
    missionList
    parserPlugins
    helper
    dbOperation
    // event callback
    stopMission
    resumeMission
    eventCallback
    constructor (OUTPUT_DIR, { thread = true, maxDownloadNum = 5, eventCallback, enableTimeSuffix }) {
        // helper 类
        this.helper = helper
        // 数据库操作
        this.dbOperation = dbOperation
        // 文件下载目录
        if (OUTPUT_DIR) this.OUTPUT_DIR = this.helper.ensurePath(OUTPUT_DIR)
        this.missionList = []
        // 终止的任务
        this.stopMission = []
        // 重启的任务
        this.resumeMission = []
        // 解析插件
        this.parserPlugins = []
        // 任务的最大线程数
        this.thread = thread && this.getCpuNum()
        // 任务同时最大下载数
        this.maxDownloadNum = maxDownloadNum || 5
        // 是否开启时间后缀
        this.enableTimeSuffix = enableTimeSuffix
        // 回调事件
        this.eventCallback = eventCallback
    }

    /**
     * @description register event callback | 注册回调事件
     * @param {function} eventCallback
     */
    registerEventCallback (eventCallback) {
        if (eventCallback && typeof eventCallback === 'function') {
            this.eventCallback = eventCallback
        }
    }

    /**
      * @description callback mission status | 回调下载任务的状态
     * @param {object} data 
     * @returns {void} 
     */
    callbackStatus (data) {
        if (this.eventCallback && typeof this.eventCallback === 'function') {
            this.eventCallback(data)
        }
    }

    /**
     * @description before create mission need operation: download dependency and sync db data ｜ 准备工作
     * @returns void
     */

    async ready () {
        await this.helper.downloadDependency()
        await this.dbOperation.sync()
        await this.initMission()
    }

    /**
     * @description get current device cpu numbers ｜ 获取当前设备的cpu核心数量
     * @returns {number} cpu numbers
     */

    getCpuNum () {
        return os.cpus().length
    }

    /**
     * @description get file download path by name ｜ 根据文件名获取下载路径
     * @param {string} name  文件名称
     * @param {string} dir 目录地址
     * @param {string} outputFormat 输出格式
     * @returns {{fileName: string, filePath: string}} path
     */
    getDownloadFilePathAndName (name, dir, outputFormat, enableTimeSuffix) {
        const tm = String(new Date().getTime())
        // 如果没有名称，就用时间戳作为名称
        let fileName = name ? name.split('/').pop() : tm
        // 获取文件下载的目录地址，在下载目录的基础上追加自定义二级目录
        const dirPath = path.join(this.OUTPUT_DIR ?? process.cwd(), dir ?? '')
        // 确保二级目录存在
        this.helper.ensureMediaDir(dirPath)
        // 是否需要时间戳后缀
        const isNeedTimeSuffix = enableTimeSuffix || this.enableTimeSuffix
        const getFileName = () => {
            const fileFormat = outputFormat || 'mp4'
            // 只有自定义名称的情况下，才考虑是否拼接时间戳后缀
            if (name && isNeedTimeSuffix) return name + '_' + tm + `.${fileFormat}`
            if (name && !isNeedTimeSuffix) return name + `.${fileFormat}`
            return tm + `.${fileFormat}`
        }
        // 获取下载文件的名称
        const filePath = path.join(dirPath, getFileName())
        return { fileName, filePath }
    }
    /**
     * @description update upload mission data/更新下载任务
     * @param {string} uid primary key / 主键 
     * @param {object} info mission information / 任务信息 
     * @param {boolean} finish is finish download mission / 是否完成下载任务
     */

    async updateMission (uid, info, finish = false) {
        const oldMission = this.missionList.find(i => i.uid === uid)
        const { percent, currentMbs: speed, timemark, targetSize: size, status, name, message } = info
        // status 任务更新为的状态
        try {
            // 下载任务管理内存在下载任务
            if (oldMission) {
                // 如果下载没有完成，并且当前下载任务的状态不是完成状态, 更新任务的状态
                // 2. 停止下载 3. 完成下载 4 错误导致下载失败
                // 更新的状态值不是完成状态（初始化、下载中、等待中）并且更新的状态为（初始化、下载中、等待中）
                if (!finish && !['2', '3', '4'].includes(status) && !['2', '3', '4'].includes(oldMission.status)) {
                    oldMission.status = status || '1' // 更新任务的状态：如果状态丢失那么默认为初始化状态
                    const updateOptions = { name, percent, speed, timemark, size, message, status: status || '1' }
                    if (info.protocolType) updateOptions.protocolType = info.protocolType
                    await this.dbOperation.DownloadService.update(uid, updateOptions)
                    // this.callbackStatus({ uid, status: status || '1' })
                } else if ((finish || ['3', '4'].includes(status)) && status !== 2) {
                    // 更新任务状态为下载完成(下载失败、完成下载)：只需要更新下载状态
                    oldMission.status = status
                    const updateOption = { status: oldMission.status }
                    // 如果是完成下载，将下载进度更新为 100
                    if (status === '3') updateOption.percent = '100'
                    // 如果是下载失败，添加错误的信息
                    if (status === '4') updateOption.message = message
                    await this.dbOperation.DownloadService.update(uid, updateOption)
                    // 回调下载任务
                    this.callbackStatus({ uid, name, status: updateOption.status, message, url: info.url })
                    if (this.stopMission.findIndex(i => i.uid === uid) !== -1) {
                        const missionToStop = this.stopMission.find(i => i.uid === uid)
                        missionToStop && missionToStop?.callback()
                    }
                    // 从missionList内移除任务
                    this.missionList = this.missionList.filter(i => i.uid !== uid)
                    this.insertNewMission()
                } else if (!finish && status === '2') {
                    log.info('manual stop mission')
                    // 手动停止下载
                    oldMission.status = '2'
                    await this.dbOperation.DownloadService.update(uid, { status: '2' })
                    this.callbackStatus({ uid, name, status: '2' })
                    // 终止下载是异步逻辑，需要通过 stopMission内的终止任务的 callback 来回调终止成功的信息
                    if (this.stopMission.findIndex(i => i.uid === uid) !== -1) {
                        const missionToStop = this.stopMission.find(i => i.uid === uid)
                        missionToStop && missionToStop?.callback()
                    }
                    this.missionList = this.missionList.filter(i => i.uid !== uid)
                    this.insertNewMission()
                }
            } else {
                // 如果没有下载任务管理内不存在任务, 直接更新库的数据
                await this.dbOperation.DownloadService.update(uid, { 
                    name, 
                    percent, 
                    speed, 
                    timemark, 
                    size, 
                    message, 
                    status: status || '1',
                })
                this.callbackStatus({ uid, name, status: status || '1' })
            }
        } catch (e) {
            log.error(e)
        }
    }

    /**
     * @description insert download mission to database for waiting download / 将下载任务添加到数据库状态为等待
     * @async
     * @param {*} mission
     * @returns {*}
     */
    async insertWaitingMission (mission) {
        await this.dbOperation.DownloadService.create(mission)
    }
    
    /**
     * @description 初始化任务：继续下载没有完成的任务，并且如果任务数量没有超过限制，添加等待的下载任务
     * @async
     * @returns {*}
     */
    async initMission () {
        const allMissions = await this.dbOperation.DownloadService.queryMissionByType('needResume')    
        // 继续恢复下载任务     
        const missions = allMissions.slice(0, this.maxDownloadNum)
        for (let mission of missions) {
            const ffmpegHelper = new FfmpegHelper()
            this.missionList.push({ ...mission.dataValues, ffmpegHelper })
            log.info('initMission for start download')
            await this.startDownload({ 
                ffmpegHelper, 
                mission, 
                outputformat: mission.outputformat || 'mp4', 
                preset: mission.preset || 'medium',
                headers: mission.headers || {},
            }, false)
        }
    }

    /**
     * @description insert new mission from waiting mission list
     * @date 2024/2/23 - 22:55:39
     * @param {*} mission
     */
    async insertNewMission () {
        log.info('insertNewMission')
        const waitingMissions = await this.dbOperation.DownloadService.queryMissionByType()
        const missionListLen = this.missionList.length
        // 插入的任务的数量
        log.info('waitingMissions length', waitingMissions.length, 'current Mission List length', missionListLen)
        const insertMissionNum = this.maxDownloadNum - missionListLen
        log.info('insertMissionNum: ', insertMissionNum)
        if (waitingMissions.length > 0) {
            const insertMissions = waitingMissions.slice(0, insertMissionNum)
            for (let mission of insertMissions) {
                log.info('add new mission')
                const ffmpegHelper = new FfmpegHelper()
                // mission.dataValues is json data
                this.missionList.push({ ...mission.dataValues, ffmpegHelper })
                await this.startDownload({ 
                    ffmpegHelper, 
                    mission, 
                    outputformat: mission.outputformat || 'mp4', 
                    preset: mission.preset || 'medium',
                    headers: mission.headers || {},
                }, false)
            }
        }
    }

    /**
     * @description 开始下载任务
     *
     * */
    async startDownload ({ mission, ffmpegHelper, outputformat, preset, headers }, isNeedInsert = true) {
        const uid = mission.uid
        try {
            // isNeedInsert为 true 表示需要新增任务到数据库
            if (isNeedInsert) await this.dbOperation.DownloadService.create(mission)
            // 设置 ffmpeg 参数
            // 设置下载任务地址和用户代理
            ffmpegHelper.setInputFile(mission.url)
            ffmpegHelper.setOutputFile(mission.filePath)
            .setUserAgent(mission.useragent)
            .setHeaders(headers)
            .setThreads(this.thread)
            .setPreset(preset)
            .setOutputFormat(outputformat)
            .start(params => {
                // 实时更新任务信息
                this.updateMission(uid, { ...mission, status: params.percent >= 100 ? '3' : '1', ...params })
            }).then(() => {
                log.info(`Successfully downloaded task: ${mission.name}`)
                // todo: create download mission support downloaded callback
                this.updateMission(uid, { ...mission, percent: 100, status: '3' }, true)
            }).catch((e) => {
                log.error('Catched downloading error:' + String(e.message))
                // 为什么终止下载会执行多次 catch
                // 下载中发生错误
                log.warn('catched downloading error:' +  String(e))
                // 以下两种错误信息都是任务被暂停 （ffmpeg-fluent 任务暂停是通过杀掉进程实现的）
                if ([
                    'ffmpeg was killed with signal SIGKILL', 
                    'ffmpeg exited with code 255',
                ].some(error => String(e).indexOf(error) !== -1)) {
                    // 任务被暂停 更新任务状态为暂停
                    this.updateMission(uid, { ...mission, status: '3', message: 'mission stopped' })
                } else {
                    // 更新任务状态为下载失败
                    this.updateMission(uid, { ...mission, status: '4', message: String(e) })
                }
            })
            return 0
        } catch (e) {
            log.error('downloading error:' + String(e))
            await this.updateMission(uid, { ...mission, status: '4', message: String(e) })
            return 1
        }
    }

    /**
     * @description create download mission 创建下载任务
     * @param {object} query url: download url, name: download mission name outputformat
     */
    async createDownloadMission (query) {
        // let enableTimeSuffix = false
        const { name, url, outputformat, preset, useragent, dir, enableTimeSuffix, headers } = query
        if (!url) throw new Error('url is required')
        log.verbose(`createDownloadMission: ${JSON.stringify(query)}`)
        const { fileName, filePath } = this.getDownloadFilePathAndName(name, dir, outputformat, enableTimeSuffix)
        const mission = { 
            uid: uuidv4(),
            name: fileName,
            url,
            status: '0',  
            filePath,
            percent: 0,
            message: '',
            useragent,
            preset,
            outputformat,
            headers,
        }
        // over max download mission 超过设置的最大同时下载任务
        if (this.missionList.length >= this.maxDownloadNum) {
            mission.status = '5' // set mission status is waiting 设置任务状态为等待
            // 添加任务到数据库
            await this.insertWaitingMission(mission)
            // 发送创建任务通知消息
            msg(this.config.webhooks, 
                this.config.webhookType, 
                i18n._('msg_title'),
                `${i18n._('create_success')}\n${i18n._('name')}: ${fileName}\n${i18n._('site')}: ${url}`)
            .catch(e => log.error(`${i18n._('send_failed')}: ` + e))
            return { uid: mission.uid, name: mission.name }
        } else {
            // continue download
            // 创建下载任务实例
            const ffmpegHelper = new FfmpegHelper()
            this.missionList.push({ ...mission, ffmpegHelper })
            await this.startDownload({ ffmpegHelper, mission, outputformat, preset, headers }, true)
            // log.verbose(`current missionList have ${this.missionList.length}s missions`)
            // 发送创建任务通知消息
            msg(this.config.webhooks, 
                this.config.webhookType, 
                i18n._('msg_title'),
                `${i18n._('create_success')}\n${i18n._('name')}: ${fileName}\n${i18n._('site')}: ${url}`)
            .catch(e => log.error(`${i18n._('send_failed')}: ` + e))
            return { uid: mission.uid, name: mission.name }
        }
    }
    
    /**
    * @description pause download mission / 暂停下载任务
    * @param {string} uid
    */
    async pauseMission (uid) {
        try {
            const mission = this.missionList.find(i => i.uid === uid) 
            if (mission) {
                mission.ffmpegHelper.kill('SIGSTOP')
                this.updateMission(uid, { ...mission, status: '2' })
            }
            return 'mission paused'
        } catch (e) {
            return e
        }
    }

    /**
    * @description resume download mission/恢复下载任务
    * @param {string} uid
    */
    async resumeDownload (uid) {
        log.info('resumeDownload')
        // 恢复下载任务存在两种情况 missionList里面已经存在数据 直接调用kill('恢复')
        const mission = this.missionList.find(i => i.uid === uid)
        if (mission) {
            mission.ffmpegHelper.kill('SIGCONT')
            log.info('mission in missionList')
            return { code: 0 }
        } else {
            let mission = await this.dbOperation.DownloadService.queryOne(uid)
            log.info('resumeDownload mission', JSON.stringify(mission))
            if (mission) {
                try {
                    mission = mission.toJSON()
                    // log.info(JSON.stringify(mission))
                    const suffix = this.helper.getUrlFileExt(mission.filePath)
                    const ffmpegHelper = new FfmpegHelper()
                    this.missionList.push({ ...mission, ffmpegHelper })
                    await this.startDownload({ 
                        ffmpegHelper, 
                        mission, 
                        outputformat: mission.outputformat || suffix, 
                        preset: mission.preset || 'medium',
                        headers: mission.headers || {},
                    }, 
                    false)
                    return { code: 0 }
                } catch (e) {
                    this.updateMission(uid, { ...mission, status: '4', message: String(e) })
                    return { code: 1, message: String(e) }
                }
            } else {
                return { code: 1, message: 'mission not found' }
            }
        }
    }   
    
    /**
     * @description delete download mission / 删除下载任务v
     * @param {string} uid
     */
    deleteDownload (uid) {
        return new Promise((resolve, reject) => {
            try {
                // 存在正在进行中的任务，那么需要将任务暂停并且删除掉
                const missionIndex = this.missionList.findIndex(i => i.uid === uid)
                if (missionIndex !== -1) {
                    const mission = this.missionList[missionIndex]
                    mission.ffmpegHelper.kill('SIGKILL')
                    // 删除任务
                    this.missionList.splice(missionIndex, 1)
                    // 数据库内删除
                }
                this.dbOperation.DownloadService.delete(uid).then(() => resolve()).catch(e => reject(e))
            } catch (e) {
                reject(e)
            }
        })
    }

    /**
     * @description stop mission download,  mission can be play event though it's not finished download / 终止下载任务
     * @param {strig} uid 
     */
    stopDownload (uid) {
        log.info(`stopDownload Mision uid: ${uid}`)
        return new Promise((resolve, reject) => {
            try {
                const mission = this.missionList.find(i => i.uid === uid)
                if (mission) {
                    // SIGKILL 下载， 这里需要判断下载任务的类型，才可以使用不同的终止方式
                    this.stopMission.push({
                        uid,
                        callback: () => {
                            resolve(0)
                        },
                    })
                    mission.ffmpegHelper.kill()
                } else {
                    // if mission is not found in missionList, to find the mission in db, change the status
                    // 还在等待中的下载任务终止，直接更新内容即可
                    this.updateMission(uid, { status: '2' }).then(() => resolve(0)).catch((e) => reject(e))
                }
            } catch (e) {
                reject(e)
            }
        })
    }


    async getMissionList (current, pageSize, status, order = 'DESC', sort = 'crt_tm') {
        return await this.dbOperation.DownloadService.queryByPage({
            pageNumber: current, pageSize, status, sortField: sort || 'crt_tm', sortOrder: order || 'DESC',
        })
    }
    /**
    * @description kill all download mission / 杀死所有的下载任务
    */
    async killAll () {
        for (const mission of this.missionList) {
            mission.ffmpegHelper.kill()
            if (mission && mission.uid && mission.status === '1') {
                try {
                    await this.updateMission(mission.uid, { ...mission, status: '2' })
                } catch (e) {
                    log.error(e.message)
                }
            }
        }
    }
}

module.exports = Oimi