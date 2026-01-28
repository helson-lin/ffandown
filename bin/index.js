const FfmpegHelper = require('./core/index')
const { HELPER: helper } = require('./utils/index')
const dbOperation = require('./sql/index')
const DownloadService = require('./sql/downloadService')
const M3U8Downloader = require('./core/dm')
const path = require('path')
const https = require('https')
const http = require('http')
const urlModule = require('url')
const os = require('os')
const i18n = require('./utils/locale')
const { v4: uuidv4 } = require('uuid')
const { LOG: log } = require('./utils/index')
const { msg } = require('./utils/message')
const { ERROR_CODE, DOWNLOAD, CLEANUP, SESSION } = require('./utils/constants')
const { Utils } = require('sequelize')
require('dotenv').config()

class Oimi {
    OUTPUT_DIR
    maxDownloadNum
    thread
    missionList
    parserPlugins
    helper
    dbOperation
    autoInstallFFmpeg
    // event callback
    stopMission
    resumeMission
    eventCallback
    // Memory cleanup related properties
    cleanupInterval
    cleanupTimer
    constructor(OUTPUT_DIR, { 
        thread = true, 
        maxDownloadNum = DOWNLOAD.MAX_CONCURRENT, 
        eventCallback, 
        enableTimeSuffix, 
        autoInstallFFmpeg,
    }) {
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
        this.maxDownloadNum = maxDownloadNum || DOWNLOAD.MAX_CONCURRENT
        // 是否开启时间后缀
        this.enableTimeSuffix = enableTimeSuffix
        // 回调事件
        this.eventCallback = eventCallback
        // 是否自动安装 ffmpeg
        this.autoInstallFFmpeg = autoInstallFFmpeg
        // 启动内存清理定时器
        this.startMemoryCleanup()
    }

    buildRequestHeaders(headers, useragent) {
        const requestHeaders = {}
        if (useragent) requestHeaders['User-Agent'] = useragent
        if (headers) {
            if (Array.isArray(headers)) {
                headers.forEach(header => {
                    if (header?.key && header?.value) requestHeaders[header.key] = header.value
                })
            } else if (typeof headers === 'object') {
                Object.assign(requestHeaders, headers)
            }
        }
        return requestHeaders
    }

    /**
     * @description register event callback | 注册回调事件
     * @param {function} eventCallback
     */
    registerEventCallback(eventCallback) {
        if (eventCallback && typeof eventCallback === 'function') {
            this.eventCallback = eventCallback
        }
    }

    /**
      * @description callback mission status | 回调下载任务的状态
     * @param {object} data 
     * @returns {void} 
     */
    callbackStatus(data) {
        if (this.eventCallback && typeof this.eventCallback === 'function') {
            this.eventCallback(data)
        }
    }

    /**
     * @description before create mission need operation: download dependency and sync db data ｜ 准备工作
     * @returns void
     */

    async ready() {
        // 下载依赖 ffmpeg/ffprobe
        if (this.autoInstallFFmpeg) await this.helper.downloadDependency()
        // 同步数据库
        await this.dbOperation.sync()
        // 初始化下载任务
        await this.initMission()
    }

    /**
     * @description get current device cpu numbers ｜ 获取当前设备的cpu核心数量
     * @returns {number} cpu numbers
     */

    getCpuNum() {
        return os.cpus().length
    }

    /**
     * @description get file download path by name ｜ 根据文件名获取下载路径
     * @param {string} name  文件名称
     * @param {string} dir 目录地址
     * @param {string} outputFormat 输出格式
     * @returns {{fileName: string, filePath: string}} path
     */
    getDownloadFilePathAndName(name, dir, outputFormat, enableTimeSuffix) {
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
        return { fileName, filePath, dirPath }
    }
    /**
     * @description update upload mission data/更新下载任务
     * @param {string} uid primary key / 主键 
     * @param {object} info mission information / 任务信息 
     * @param {boolean} finish is finish download mission / 是否完成下载任务
     */

    async updateMission(uid, info, finish = false) {
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
                    await DownloadService.update(uid, updateOptions)
                    // this.callbackStatus({ uid, status: status || '1' })
                } else if ((finish || ['3', '4'].includes(status)) && status !== 2) {
                    // 更新任务状态为下载完成(下载失败、完成下载)：只需要更新下载状态
                    oldMission.status = status
                    const updateOption = { status: oldMission.status }
                    // 如果是完成下载，将下载进度更新为 100
                    if (status === '3') updateOption.percent = '100'
                    // 如果是下载失败，添加错误的信息
                    if (status === '4') updateOption.message = message
                    await DownloadService.update(uid, updateOption)
                    // 回调下载任务
                    this.callbackStatus({ uid, name, status: updateOption.status, message, url: info.url })
                    if (this.stopMission.findIndex(i => i.uid === uid) !== -1) {
                        const missionToStop = this.stopMission.find(i => i.uid === uid)
                        if (missionToStop) {
                            missionToStop.callback()
                            // 执行完 callback 后从 stopMission 数组中移除，防止内存泄漏
                            this.stopMission = this.stopMission.filter(i => i.uid !== uid)
                        }
                    }
                    // 从missionList内移除任务
                    this.missionList = this.missionList.filter(i => i.uid !== uid)
                    this.insertNewMission()
                } else if (!finish && status === '2') {
                    log.info('Manual stop mission')
                    // 手动停止下载
                    oldMission.status = '2'
                    await DownloadService.update(uid, { status: '2' })
                    this.callbackStatus({ uid, name, status: '2' })
                    // 终止下载是异步逻辑，需要通过 stopMission内的终止任务的 callback 来回调终止成功的信息
                    if (this.stopMission.findIndex(i => i.uid === uid) !== -1) {
                        const missionToStop = this.stopMission.find(i => i.uid === uid)
                        if (missionToStop) {
                            missionToStop.callback()
                            // 执行完 callback 后从 stopMission 数组中移除，防止内存泄漏
                            this.stopMission = this.stopMission.filter(i => i.uid !== uid)
                        }
                    }
                    this.missionList = this.missionList.filter(i => i.uid !== uid)
                    this.insertNewMission()
                }
            } else {
                // 如果没有下载任务管理内不存在任务, 直接更新库的数据
                await DownloadService.update(uid, {
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
    async insertWaitingMission(mission) {
        await DownloadService.create(mission)
    }

    /**
     * @description 初始化任务：继续下载没有完成的任务，并且如果任务数量没有超过限制，添加等待的下载任务
     * @async
     * @returns {*}
     */
    async initMission() {
        const allMissions = await DownloadService.queryMissionByType('needResume')
        // 继续恢复下载任务     
        const missions = allMissions.slice(0, this.maxDownloadNum)
        for (let mission of missions) {
            const ffmpegHelper = new FfmpegHelper()
            this.missionList.push({ ...mission, ffmpegHelper })
            log.info('Init mission for start download')
            await this.startDownload({
                ffmpegHelper,
                mission,
                outputformat: mission.outputformat || 'mp4',
                preset: mission.preset || 'medium',
                headers: mission.headers || {},
                onlyTranscode: mission.onlyTranscode || '0',
            }, false)
        }
    }

    /**
     * @description insert new mission from waiting mission list
     * @date 2024/2/23 - 22:55:39
     * @param {*} mission
     */
    async insertNewMission() {
        const waitingMissions = await DownloadService.queryMissionByType()
        const missionListLen = this.missionList.length
        // 插入的任务的数量
        const insertMissionNum = this.maxDownloadNum - missionListLen
        if (waitingMissions.length > 0) {
            const insertMissions = waitingMissions.slice(0, insertMissionNum)
            for (let mission of insertMissions) {
                const ffmpegHelper = new FfmpegHelper()
                // mission.dataValues is json data
                this.missionList.push({ ...mission, ffmpegHelper })
                await this.startDownload({
                    ffmpegHelper,
                    mission,
                    outputformat: mission.outputformat || 'mp4',
                    preset: mission.preset || 'medium',
                    headers: mission.headers || {},
                    onlyTranscode: mission.onlyTranscode || '0',
                }, false)
            }
        }
    }

    /**
     * @description 判断 URL 是否为 m3u8 格式（同步检查）
     * @param {string} url URL 地址
     * @returns {boolean} 是否为 m3u8 格式
     */
    isM3u8Url(url) {
        if (!url || typeof url !== 'string') {
            return false
        }

        // 移除查询参数，只检查路径部分
        const urlWithoutQuery = url.split('?')[0].toLowerCase()

        // 1. 检查文件扩展名
        if (urlWithoutQuery.endsWith('.m3u8') || urlWithoutQuery.endsWith('.m3u')) {
            return true
        }

        // 2. 检查 URL 中的关键词
        const m3u8Keywords = [
            'playlist.m3u8',
            'index.m3u8',
            'master.m3u8',
            'stream.m3u8',
            '/m3u8/',
            'hls/',
            'playlist',
            'segments',
        ]

        const fullUrl = url.toLowerCase()
        if (m3u8Keywords.some(keyword => fullUrl.includes(keyword))) {
            return true
        }

        // 3. 检查查询参数中的格式标识
        if (fullUrl.includes('format=m3u8') ||
            fullUrl.includes('type=hls') ||
            fullUrl.includes('protocol=hls')) {
            return true
        }

        return false
    }

    /**
     * @description 异步检查 URL 是否为 m3u8 格式（包含网络请求检查）
     * @param {string} url URL 地址
     * @param {object} headers 请求头
     * @returns {Promise<boolean>} 是否为 m3u8 格式
     */
    async isM3u8UrlAsync(url, headers = {}) {
        // 先进行同步检查
        if (this.isM3u8Url(url)) {
            return true
        }

        try {
            const urlObject = urlModule.parse(url)
            const isHttps = urlObject.protocol === 'https:'
            const requestModule = isHttps ? https : http

            return new Promise((resolve) => {
                const requestOptions = {
                    hostname: urlObject.hostname,
                    port: urlObject.port || (isHttps ? 443 : 80),
                    path: urlObject.path,
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; M3U8Detector)',
                        ...headers,
                    },
                    timeout: 5000,
                }

                const req = requestModule.request(requestOptions, (res) => {
                    const contentType = res.headers['content-type'] || ''

                    // 检查 Content-Type
                    if (contentType.includes('application/vnd.apple.mpegurl') ||
                        contentType.includes('application/x-mpegURL') ||
                        contentType.includes('audio/mpegurl') ||
                        contentType.includes('audio/x-mpegurl') ||
                        contentType.includes('text/plain')) {
                        resolve(true)
                        return
                    }

                    // 如果是 text/plain，可能需要进一步检查内容
                    if (contentType.includes('text/plain') || contentType.includes('text/')) {
                        // 发送 GET 请求检查内容前几行
                        this.checkM3u8Content(url, headers).then(resolve).catch(() => resolve(false))
                    } else {
                        resolve(false)
                    }
                })

                req.on('timeout', () => {
                    req.abort()
                    resolve(false)
                })

                req.on('error', () => {
                    resolve(false)
                })

                req.end()
            })

        } catch (error) {
            log.error('M3U8 URL async check error:', error.message)
            return false
        }
    }

    /**
     * @description 检查 URL 内容是否为 M3U8 格式
     * @param {string} url URL 地址
     * @param {object} headers 请求头
     * @returns {Promise<boolean>} 是否为 m3u8 格式
     */
    async checkM3u8Content(url, headers = {}) {
        try {

            const urlObject = urlModule.parse(url)
            const isHttps = urlObject.protocol === 'https:'
            const requestModule = isHttps ? https : http

            return new Promise((resolve) => {
                const requestOptions = {
                    hostname: urlObject.hostname,
                    port: urlObject.port || (isHttps ? 443 : 80),
                    path: urlObject.path,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; M3U8Detector)',
                        'Range': 'bytes=0-1023', // 只读取前 1KB
                        ...headers,
                    },
                    timeout: 10000,
                }

                const req = requestModule.request(requestOptions, (res) => {
                    let data = ''
                    let bytesReceived = 0
                    const maxBytes = 1024 // 最多读取 1KB

                    res.on('data', (chunk) => {
                        bytesReceived += chunk.length
                        data += chunk.toString()

                        // 限制读取的数据量
                        if (bytesReceived >= maxBytes) {
                            res.destroy()
                        }
                    })

                    res.on('end', () => {
                        // 检查是否包含 M3U8 特征标识
                        const m3u8Patterns = [
                            '#EXTM3U',
                            '#EXT-X-VERSION',
                            '#EXT-X-TARGETDURATION',
                            '#EXT-X-MEDIA-SEQUENCE',
                            '#EXT-X-STREAM-INF',
                            '#EXTINF',
                        ]

                        const hasM3u8Pattern = m3u8Patterns.some(pattern =>
                            data.toUpperCase().includes(pattern),
                        )

                        resolve(hasM3u8Pattern)
                    })
                })

                req.on('timeout', () => {
                    req.abort()
                    resolve(false)
                })

                req.on('error', () => {
                    resolve(false)
                })

                req.end()
            })
        } catch (error) {
            log.error('M3U8 content check error:', error.message)
            return false
        }
    }

    /**
     * @description get ffmpeg error code from error message / 从错误信息中获取 ffmpeg 错误代码
     * @param {string} errorMessage 错误信息
     * @returns {string} 错误代码
     */
    getFfmpegErrorCode(errorMessage) {
        if (!errorMessage) {
            return null
        }

        // 尝试多种可能的错误代码格式
        const patterns = [
            /code (\d+)/,           // 标准格式: "code 123"
            /error code (\d+)/,     // 带error前缀: "error code 123"
            /exit code (\d+)/,      // 退出码: "exit code 123"
            /exit with code (\d+)/, // 带with的退出码: "exit with code 123"
            /Error (\d+)/,          // 大写Error: "Error 123"
        ]

        for (const pattern of patterns) {
            const match = errorMessage.match(pattern)
            if (match && match[1]) {
                const code = match[1]
                return code
            }
        }

        return null
    }

    /**
     * @description 直接下载，仅使用 ffmpeg 转码
     * @param {*} mission 
     */
    downloadDirectly(options) {
        const { mission, dirPath, headers, uid } = options
        const normalizedHeaders = this.buildRequestHeaders(headers, mission.useragent)
        const downloader = new M3U8Downloader({
            debug: true,
            url: mission.url,
            filename: mission.name,
            outputDir: dirPath,
            concurrency: 20,
            headers: normalizedHeaders,
            allowInsecureHttps: true,
        })
        downloader.on('progress', (progress) => {
            const currentSpeed = progress.currentSpeed
            const averageSpeed = progress.averageSpeed
            const downloadedSize = progress.downloadedBytes
            const currentFileSize = progress.bytes
            const params = {
                percent: progress.percentage >= 100 ? 100 : progress.percentage,
                status: progress.percentage >= 100 ? '3' : '1',
                currentMbs: currentSpeed,
                timemark: '',
                targetSize: progress.currentFileSize,
                protocolType: 'm3u8',
            }
            log.info(
                `Progress: ${progress.percentage}%\n` +
                `  速度: 当前 ${currentSpeed} | 平均 ${averageSpeed}\n` +
                `  已下载: ${downloadedSize} | 当前文件: ${currentFileSize}`,
            )
            this.updateMission(uid, { ...mission, ...params })
        })

        downloader.on('merged', (result) => {
            log.info(`Successfully merged task: ${mission.name}`)
            this.updateMission(uid, { ...mission, percent: 100, status: '3' }, true)
            if (result.mergeElapsed !== undefined) {
                log.info(`   合并耗时: ${result.mergeElapsed.toFixed(2)} 秒`)
            }
        })
        downloader.on('error', (error) => {
            log.error('Catched m3u8downloader  error: ' + String(error.message))
            this.updateMission(uid, { ...mission, status: '4', message: String(error.message) })
        })
        downloader.on('merged-error', (error) => {
            log.error('Catched merged error: ' + String(error.message))
            this.updateMission(uid, { ...mission, status: '4', message: String(error.message) })
        })
        downloader.download()

        // 返回 downloader 实例以便存储到 missionList 中
        return { downloader, result: 0 }
    }

    /**
     * @description ffmpeg下载并转码
     * @param {*} mission 
     */
    downloadWithFFmpeg(options) {
        const { uid, mission, headers, preset, outputformat, ffmpegHelper } = options
        // 设置 ffmpeg 参数
        // 设置下载任务地址和用户代理
        ffmpegHelper.setInputFile(mission.url)
        // 如果存在 audioUrl，那么追加音频地址
        ffmpegHelper.setInputAudioFile(mission?.audioUrl)
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
            this.updateMission(uid, { ...mission, percent: 100, status: '3' }, true)
        }).catch((e) => {
            log.error('Catched downloading error: ' + String(e.message))
            // 为什么终止下载会执行多次 catch
            // 下载中发生错误
            // 以下两种错误信息都是任务被暂停 （ffmpeg-fluent 任务暂停是通过杀掉进程实现的）
            if ([
                'ffmpeg was killed with signal SIGKILL',
                'ffmpeg exited with code 255',
            ].some(error => String(e).indexOf(error) !== -1)) {
                // 任务被暂停 更新任务状态为暂停
                this.updateMission(uid, { ...mission, status: '3', message: 'mission stopped' })
            } else {
                // 确保错误信息完整
                const errorMessage = e.message || e.toString()
                const errorCode = this.getFfmpegErrorCode(errorMessage)
                const finalErrorMessage = ERROR_CODE.includes(errorCode)
                    ? i18n._(`ERROR_CODE_${errorCode}`)
                    : errorMessage
                    // 更新任务状态为下载失败
                this.updateMission(uid, { ...mission, status: '4', message: finalErrorMessage })
            }
        })
        return 0
    }

    /**
     * @description 开始下载任务
     *
     * */
    async startDownload({ 
        mission, 
        ffmpegHelper, 
        outputformat, 
        preset, 
        headers, 
        onlyTranscode, 
        dirPath,
    }, 
    isNeedInsert = true) {
        const uid = mission.uid
        try {
            // isNeedInsert为 true 表示需要新增任务到数据库
            if (isNeedInsert) await DownloadService.create(mission)

            // 如果 onlyTranscode 为 1，需要检查是否为 M3U8 格式
            if (onlyTranscode === '1') {
                log.info(`onlyTranscode is set to 1, checking if URL is M3U8: ${mission.url}`)
                const requestHeaders = this.buildRequestHeaders(headers, mission.useragent)
                // 先进行同步检查
                let isM3u8 = this.isM3u8Url(mission.url)

                // 如果同步检查不通过，进行异步检查（网络请求）
                if (!isM3u8) {
                    log.info(`Performing async M3U8 check for URL: ${mission.url}`)

                    try {
                        isM3u8 = await this.isM3u8UrlAsync(mission.url, requestHeaders)
                        log.info(`Async M3U8 check result: ${isM3u8}`)
                    } catch (error) {
                        log.error('Async M3U8 check failed:', error.message)
                        isM3u8 = false
                    }
                }

                if (isM3u8) {
                    // 使用 M3U8Downloader 下载
                    log.info(`Using M3U8Downloader for: ${mission.url}`)
                    const downloadResult = this.downloadDirectly({
                        uid,
                        mission,
                        headers: requestHeaders,
                        preset,
                        outputformat,
                        dirPath,
                    })

                    // 将 downloader 实例存储到 missionList 中
                    const missionInList = this.missionList.find(m => m.uid === uid)
                    if (missionInList) {
                        missionInList.m3u8Downloader = downloadResult.downloader
                    }

                    return downloadResult.result
                } else {
                    // 虽然设置了 onlyTranscode，但不是 M3U8 格式，使用 FFmpeg
                    log.info(`URL is not M3U8 format, using FFmpeg for: ${mission.url}`)
                    return this.downloadWithFFmpeg({
                        uid,
                        mission,
                        headers: requestHeaders,
                        preset,
                        outputformat,
                        ffmpegHelper,
                    })
                }
            } else {
                // onlyTranscode 不为 1，直接使用 FFmpeg
                log.info(`onlyTranscode is not set to 1, using FFmpeg for: ${mission.url}`)
                const requestHeaders = this.buildRequestHeaders(headers, mission.useragent)
                return this.downloadWithFFmpeg({
                    uid,
                    mission,
                    headers: requestHeaders,
                    preset,
                    outputformat,
                    ffmpegHelper,
                })
            }
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
    async createDownloadMission(query) {
        // let enableTimeSuffix = false
        const { name, url, outputformat, preset, useragent, dir, enableTimeSuffix, headers, onlyTranscode } = query
        if (!url) throw new Error('url is required')
        log.info(`Create download mission: ${JSON.stringify(query, null, 2)}`)
        const { fileName, filePath, dirPath } = this.getDownloadFilePathAndName(
            name, 
            dir, 
            outputformat, 
            enableTimeSuffix,
        )
        const mission = {
            uid: uuidv4(),
            name: fileName,
            url,
            status: '0',
            filePath,
            dir,
            percent: 0,
            message: '',
            useragent,
            preset,
            outputformat,
            headers,
            audioUrl: query?.audioUrl || '',
            onlyTranscode: onlyTranscode || '0',
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
            await this.startDownload({ 
                ffmpegHelper, 
                mission, 
                outputformat, 
                preset, 
                headers, 
                onlyTranscode, 
                dirPath,
            }, 
            true)
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
    async pauseMission(uid) {
        try {
            const mission = this.missionList.find(i => i.uid === uid)
            if (mission) {
                // 如果是 M3U8 下载任务，使用 downloader.pause()
                if (mission.m3u8Downloader) {
                    mission.m3u8Downloader.pause()
                    log.info(`Paused M3U8 download: ${mission.name}`)
                }
                // 如果是 FFmpeg 下载任务，使用 ffmpegHelper
                else if (mission.ffmpegHelper) {
                    mission.ffmpegHelper.kill('SIGSTOP')
                    log.info(`Paused FFmpeg download: ${mission.name}`)
                }

                this.updateMission(uid, { ...mission, status: '2' })
            }
            return 'mission paused'
        } catch (e) {
            log.error('Pause mission error:', e)
            return e
        }
    }

    /**
    * @description resume download mission/恢复下载任务
    * @param {string} uid
    */
    async resumeDownload(uid) {
        log.info('Resume download')
        // 恢复下载任务存在两种情况 missionList里面已经存在数据 直接调用恢复方法
        const mission = this.missionList.find(i => i.uid === uid)
        if (mission) {
            // 如果是 M3U8 下载任务，使用 downloader.resume()
            if (mission.m3u8Downloader) {
                mission.m3u8Downloader.resume()
                log.info(`Resumed M3U8 download: ${mission.name}`)
                this.updateMission(uid, { ...mission, status: '1' })
            }
            // 如果是 FFmpeg 下载任务，使用 ffmpegHelper
            else if (mission.ffmpegHelper) {
                mission.ffmpegHelper.kill('SIGCONT')
                log.info(`Resumed FFmpeg download: ${mission.name}`)
                this.updateMission(uid, { ...mission, status: '1' })
            }

            return { code: 0 }
        } else {
            // 从数据库查找任务并重新启动
            let mission = await DownloadService.queryOne(uid)
            if (mission) {
                try {
                    mission = mission.toJSON()
                    log.info('Resume download mission: ' + JSON.stringify(mission, null, 2))
                    const suffix = this.helper.getUrlFileExt(mission.filePath)

                    // 根据任务类型决定恢复方式
                    if (mission.onlyTranscode === '1') {
                        // 检查是否为 M3U8 格式（使用改进的检测方法）
                        let isM3u8 = this.isM3u8Url(mission.url)

                        if (!isM3u8) {
                            // 进行异步检测
                            const requestHeaders = {}
                            if (mission.useragent) {
                                requestHeaders['User-Agent'] = mission.useragent
                            }

                            try {
                                isM3u8 = await this.isM3u8UrlAsync(mission.url, requestHeaders)
                                log.info(`Resume - Async M3U8 check result for ${mission.url}: ${isM3u8}`)
                            } catch (error) {
                                log.error('Resume - Async M3U8 check failed:', error.message)
                                isM3u8 = false
                            }
                        }

                        if (isM3u8) {
                            // M3U8 任务需要重新开始下载
                            const { dirPath } = this.getDownloadFilePathAndName(
                                mission.name, 
                                mission.dir, 
                                mission.outputformat, 
                                mission.enableTimeSuffix,
                            )
                            this.missionList.push({ ...mission })
                            await this.startDownload({
                                mission,
                                outputformat: mission.outputformat || 'mp4',
                                preset: mission.preset || 'medium',
                                headers: mission.headers || {},
                                onlyTranscode: mission.onlyTranscode || '0',
                                dirPath,
                            }, false)
                        } else {
                            // 虽然设置了 onlyTranscode，但不是 M3U8 格式，使用 FFmpeg
                            const ffmpegHelper = new FfmpegHelper()
                            this.missionList.push({ ...mission, ffmpegHelper })
                            await this.startDownload({
                                ffmpegHelper,
                                mission,
                                outputformat: mission.outputformat || suffix,
                                preset: mission.preset || 'medium',
                                headers: mission.headers || {},
                                onlyTranscode: mission.onlyTranscode || '0',
                            }, false)
                        }
                    } else {
                        // FFmpeg 任务
                        const ffmpegHelper = new FfmpegHelper()
                        this.missionList.push({ ...mission, ffmpegHelper })
                        await this.startDownload({
                            ffmpegHelper,
                            mission,
                            outputformat: mission.outputformat || suffix,
                            preset: mission.preset || 'medium',
                            headers: mission.headers || {},
                            onlyTranscode: mission.onlyTranscode || '0',
                        }, false)
                    }

                    // 更新任务状态为初始化
                    this.updateMission(uid, { ...mission, status: '0' })
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
     * @description delete download mission / 删除下载任务
     * @param {string} uid
     */
    deleteDownload(uid) {
        return new Promise((resolve, reject) => {
            try {
                // 存在正在进行中的任务，那么需要将任务暂停并且删除掉
                const missionIndex = this.missionList.findIndex(i => i.uid === uid)
                if (missionIndex !== -1) {
                    const mission = this.missionList[missionIndex]

                    // 根据任务类型强制停止下载
                    if (mission.m3u8Downloader) {
                        // 强制停止 M3U8 下载任务
                        mission.m3u8Downloader.stop()
                        log.info(`Deleted M3U8 download: ${mission.name}`)
                    } else if (mission.ffmpegHelper) {
                        // 强制停止 FFmpeg 下载任务
                        mission.ffmpegHelper.kill('SIGKILL')
                        log.info(`Deleted FFmpeg download: ${mission.name}`)
                    }

                    // 删除任务
                    this.missionList.splice(missionIndex, 1)
                }

                // 数据库内删除
                DownloadService.delete(uid).then(() => resolve()).catch(e => reject(e))
            } catch (e) {
                reject(e)
            }
        })
    }

    /**
     * @description stop mission download,  mission can be play event though it's not finished download / 终止下载任务
     * @param {strig} uid 
     */
    stopDownload(uid) {
        log.info(`Stop download mission uid: ${uid}`)
        return new Promise((resolve, reject) => {
            try {
                const mission = this.missionList.find(i => i.uid === uid)
                if (mission) {
                    // 添加到停止队列，用于回调处理（使用新方法，自动添加时间戳和限制大小）
                    this.addStopMissionRecord({
                        uid,
                        callback: () => {
                            resolve(0)
                        },
                    })

                    // 根据任务类型停止下载
                    if (mission.m3u8Downloader) {
                        // 停止 M3U8 下载任务
                        mission.m3u8Downloader.stop()
                        log.info(`Stopped M3U8 download: ${mission.name}`)
                    } else if (mission.ffmpegHelper) {
                        // 停止 FFmpeg 下载任务
                        mission.ffmpegHelper.kill()
                        log.info(`Stopped FFmpeg download: ${mission.name}`)
                    }
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


    async getMissionList(current, pageSize, status, order = 'DESC', sort = 'crt_tm') {
        return await DownloadService.queryByPage({
            pageNumber: current, pageSize, status, sortField: sort || 'crt_tm', sortOrder: order || 'DESC',
        })
    }
    /**
    * @description kill all download mission / 杀死所有的下载任务
    */
    async killAll() {
        for (const mission of this.missionList) {
            // 根据任务类型停止下载
            if (mission.m3u8Downloader) {
                // 停止 M3U8 下载任务
                mission.m3u8Downloader.stop()
                log.info(`Killed M3U8 download: ${mission.name}`)
            } else if (mission.ffmpegHelper) {
                // 停止 FFmpeg 下载任务
                mission.ffmpegHelper.kill()
                log.info(`Killed FFmpeg download: ${mission.name}`)
            }

            if (mission && mission.uid && mission.status === '1') {
                try {
                    await this.updateMission(mission.uid, { ...mission, status: '2' })
                } catch (e) {
                    log.error(e.message)
                }
            }
        }
    }

    /**
     * @description Start memory cleanup timer to prevent memory leaks / 启动内存清理定时器以防止内存泄漏
     */
    startMemoryCleanup() {
        if (!CLEANUP.AUTO_CLEANUP_ENABLED || this.cleanupTimer) {
            return
        }

        // 设置定期清理任务
        this.cleanupTimer = setInterval(() => {
            try {
                this.performMemoryCleanup()
            } catch (e) {
                log.error('Memory cleanup error: ' + e.message)
            }
        }, CLEANUP.INTERVAL)

        log.info('Memory cleanup timer started (every 30 minutes)')
    }

    /**
     * @description Stop memory cleanup timer / 停止内存清理定时器
     */
    stopMemoryCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer)
            this.cleanupTimer = null
            log.info('Memory cleanup timer stopped')
        }
    }

    /**
     * @description Perform memory cleanup / 执行内存清理
     */
    performMemoryCleanup() {
        log.info('Running memory cleanup...')

        // 清理 stopMission 数组（移除已处理的任务）
        const stopMissionBefore = this.stopMission.length
        // 时间戳过滤（清理超过24小时的旧记录）
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000
        this.stopMission = this.stopMission.filter(item => item.timestamp && item.timestamp > cutoffTime)
        const stopMissionAfter = this.stopMission.length

        // 限制数组最大长度
        this.limitStopMissionArray()

        // 清理 resumeMission 数组（如果有内容）
        const resumeMissionBefore = this.resumeMission.length
        this.resumeMission = this.resumeMission.filter(item => item.timestamp && item.timestamp > cutoffTime)
        const resumeMissionAfter = this.resumeMission.length
        if (resumeMissionAfter > CLEANUP.MAX_COMPLETED_MISSION_RETENTION) {
            this.resumeMission = this.resumeMission.slice(-CLEANUP.MAX_COMPLETED_MISSION_RETENTION)
        }

        log.info(
            `Memory cleanup completed - stopMission: ${stopMissionBefore} -> ${stopMissionAfter}, ` + 
            `resumeMission: ${resumeMissionBefore} -> ${this.resumeMission.length}`,
        )
    }

    /**
     * @description Limit stopMission array size to prevent memory leak / 限制 stopMission 数组大小以防止内存泄漏
     */
    limitStopMissionArray() {
        const currentLength = this.stopMission.length

        if (currentLength > CLEANUP.MAX_STOP_MISSION_RETENTION) {
            // 按时间戳排序（新任务在前）
            this.stopMission.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

            // 保留最新的 MAX_STOP_MISSION_RETENTION 个任务
            this.stopMission = this.stopMission.slice(0, CLEANUP.MAX_STOP_MISSION_RETENTION)
            log.warn(
                'Stop mission array exceeded max retention limit, trimmed from ' +
                `${currentLength} to ${this.stopMission.length}`,
            )
        }
    }

    /**
     * @description Add stop mission record with timestamp / 添加停止任务记录（带有时间戳）
     * @param {Object} record 停止任务记录
     */
    addStopMissionRecord(record) {
        // 为每个记录添加时间戳
        const recordWithTimestamp = {
            ...record,
            timestamp: Date.now(),
        }

        this.stopMission.push(recordWithTimestamp)

        // 如果超过最大限制，立即清理最早的记录
        if (this.stopMission.length > CLEANUP.MAX_STOP_MISSION_RETENTION * 1.5) {
            this.limitStopMissionArray()
        }
    }
}

module.exports = Oimi