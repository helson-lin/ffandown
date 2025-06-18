/* eslint-disable camelcase */
/**
 * @description M3U8 to MP4 Converter
 * @author Furkan Inanc, Helson Lin
 * @version 1.0.0
 */
const ffmpeg = require('fluent-ffmpeg')
const { LOG: log } = require('../utils/index')
const os = require('os')

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const { hardWareDetect } = require('../utils/hardwave')

const DEFAULT_USER_AGENT = 
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36'
/**
  * A class to convert M3U8 to MP4
  * @class
  */
class FfmpegHelper {
    INPUT_FILE
    OUTPUT_FILE
    INPUT_AUDIO_FILE
    PRESET
    OUTPUTFORMAT
    USER_AGENT
    HEADERS
    THREADS
    PROTOCOL_TYPE
    duration
    hardwareAccel = null // 硬件加速器
    hwAccelInfo = null // 硬件加速器信息
    systemInfo = null
    constructor (options) {
        if (options?.THREADS) this.THREADS = options.THREADS
        this.HEADERS = []
        this.downloadedBytes = 0
        this.collectSystemInfo()
    }

    /**
     * @description 收集系统信息用于诊断
     */
    collectSystemInfo() {
        try {
            this.systemInfo = {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                ffmpegVersion: this.getFFmpegVersion(),
                cpuInfo: os.cpus()[0],
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                loadAvg: os.loadavg(),
            }
            log.info('System information collected for diagnostics')
        } catch (error) {
            log.error('Failed to collect system information:', error)
        }
    }

    /**
     * @description 获取 FFmpeg 版本信息
     * @returns {string}
     */
    getFFmpegVersion() {
        try {
            const ffmpegCmd = ffmpeg()
            ffmpegCmd._getFfmpegPath((_, libPath) => {
                return execSync(`${libPath} -version`).toString().split('\n')[0]
            })
        } catch (error) {
            return 'Unknown'
        }
    }

    /**
     * @description 检查 FFmpeg 兼容性
     * @returns {Promise<boolean>}
     */
    async checkFFmpegCompatibility() {
        return new Promise((resolve) => {
            try {
                // 检查基本功能 - 使用 ffmpeg 而不是 ffprobe
                const ffmpegCmd = ffmpeg()
                ffmpegCmd.getAvailableFormats((err) => {
                    if (err) {
                        log.error('FFmpeg compatibility check failed:', err)
                        resolve(false)
                        return
                    }

                    // 检查编码器支持
                    ffmpegCmd.getAvailableEncoders((err) => {
                        if (err) {
                            log.error('Failed to check encoders:', err)
                            resolve(false)
                            return
                        }

                        // 如果能获取到格式和编码器信息，说明 FFmpeg 工作正常
                        log.info('FFmpeg compatibility check passed')
                        resolve(true)
                    })
                })
            } catch (error) {
                log.error('FFmpeg compatibility check error:', error)
                resolve(false)
            }
        })
    }

    /**
     * @description 生成诊断报告
     * @param {Error} error 错误信息
     * @returns {string}
     */
    generateDiagnosticReport(error) {
        // 收集 FFmpeg 命令相关信息
        const ffmpegCommandInfo = {
            fullCommand: this.ffmpegCmd ? this.ffmpegCmd._currentCommand : 'Not available',
            inputOptions: this.ffmpegCmd ? this.ffmpegCmd._inputOptions : [],
            outputOptions: this.ffmpegCmd ? this.ffmpegCmd._outputOptions : [],
            inputs: this.ffmpegCmd ? this.ffmpegCmd._inputs : [],
            outputs: this.ffmpegCmd ? this.ffmpegCmd._outputs : [],
            format: this.OUTPUTFORMAT || 'mp4',
            preset: this.PRESET || 'veryfast',
            threads: this.THREADS || 'auto',
        }

        // 收集配置参数
        const configurationInfo = {
            userAgent: this.USER_AGENT || DEFAULT_USER_AGENT,
            headers: this.HEADERS || [],
            hardwareAccel: this.hardwareAccel || 'none',
            protocolType: this.PROTOCOL_TYPE || 'unknown',
            timeMark: this.TIMEMARK || 'none',
            duration: this.duration || 0,
        }

        const report = {
            timestamp: new Date().toISOString(),
            reportId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'ERROR',
            error: {
                message: error.message,
                stack: error.stack,
                code: error.code,
                signal: error.signal,
                killed: error.killed,
            },
            ffmpegCommand: ffmpegCommandInfo,
            configuration: configurationInfo,
            files: {
                inputFile: this.INPUT_FILE,
                outputFile: this.OUTPUT_FILE,
                inputAudioFile: this.INPUT_AUDIO_FILE || null,
            },
            systemInfo: this.systemInfo,
            executionContext: {
                startTime: this.startTime ? new Date(this.startTime).toISOString() : null,
                errorTime: new Date().toISOString(),
                downloadedBytes: this.downloadedBytes || 0,
                processMemoryUsage: process.memoryUsage(),
            },
        }

        return JSON.stringify(report, null, 2)
    }

    /**
     * @description 处理 FFmpeg 错误
     * @param {Error} error 错误信息
     */
    handleFFmpegError(error) {
        const diagnosticReport = this.generateDiagnosticReport(error)
        log.error('FFmpeg Error Diagnostic Report:', diagnosticReport)

        // 检查是否是 SIGSEGV 错误
        if (error.message.includes('SIGSEGV')) {
            log.error('FFmpeg crashed with SIGSEGV. Possible causes:')
            log.error('1. Memory issues or hardware acceleration problems')
            log.error('2. Incompatible FFmpeg version')
            log.error('3. System resource limitations')
            log.error('4. Corrupted input file or stream')
            
            // 提供解决建议
            log.info('Suggested solutions:')
            log.info('1. Try disabling hardware acceleration')
            log.info('2. Update FFmpeg to the latest version')
            log.info('3. Check system memory and CPU usage')
            log.info('4. Verify input file/stream integrity')
            log.info('5. Try using a different preset (e.g., "veryfast" instead of "medium")')
        }

        // 检查是否是网络超时错误
        if (error.message.includes('Operation timed out') || 
            error.message.includes('Connection timed out') ||
            error.message.includes('timeout') ||
            error.message.includes('Error opening input file')) {
            log.error('Network connection issues:')
            log.error('1. Network connection instability or slow speed')
            log.error('2. Server response timeout')
            log.error('3. URL is invalid or resource is not accessible')
            log.error('4. Firewall or proxy blocks the connection')
            log.error('5. Server limits access frequency')
        }

        // 保存诊断报告到文件
        try {
            // 生成唯一的错误报告文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const inputFileName = this.getSimplifiedFileName(this.INPUT_FILE || 'unknown')
            const errorCode = error.code || 'unknown-error'
            const reportFileName = `ffmpeg-error-${timestamp}-${inputFileName}-${errorCode}.json`
            
            // 确保 error-reports 目录存在
            const reportDir = path.join(process.cwd(), 'error-reports')
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true })
            }
            
            const reportPath = path.join(reportDir, reportFileName)
            fs.writeFileSync(reportPath, diagnosticReport)
            log.info(`Diagnostic report saved to: ${reportPath}`)
        } catch (writeError) {
            log.error('Failed to save diagnostic report:', writeError)
        }
    }

    /**
     * @description 设置用户代理
     * @param {string} USER_AGENT 
     */
    setUserAgent (USER_AGENT) {
        if (USER_AGENT) this.USER_AGENT = USER_AGENT
        return this
    }

    /**
      * @description 设置输入文件地址
      * @param {String} filename M3U8 file path. You can use remote URL
      */
    setInputFile (INPUT_FILE) {
        if (!INPUT_FILE) throw new Error('You must specify the M3U8 file address')
        this.INPUT_FILE = INPUT_FILE
        return this
    }

    /**
     * @description 设置音频地址
     * @param {String} INPUT_FILE 
     */
    setInputAudioFile (INPUT_FILE) {
        if (!INPUT_FILE) return this
        this.INPUT_AUDIO_FILE = INPUT_FILE
        return this
    }

    /**
    * @description 设置输出文件地址
    * @param {String} filename Output file path. Has to be local :)
    * @returns {Function}
    */
    setOutputFile (OUTPUT_FILE) {
        if (!OUTPUT_FILE) throw new Error('You must specify the OUTPUT_FILE')
        this.OUTPUT_FILE = OUTPUT_FILE
        return this
    }

    /**
    * @description 设置线程数 Sets the thread
    * @param {Number} number thread number
    * @returns {Function}
    */
    setThreads (number) {
        if (number) this.THREADS = number
        return this
    }

    /**
     * @description 设置请求头
     * @param {Object} headers 
     * @returns 
     */
    setHeaders (headers) {
        if (Object.prototype.toString.call(headers) !== '[object Array]') return this
        if (headers && headers.length > 0) this.HEADERS = headers
        return this
    }

    /**
     * @description 设置视频预设 set video preset
     * @param {String} preset video preset
     */
    setPreset (preset) {
        if (preset) this.PRESET = preset
        return this
    }

    /**
     * @description 设置输出视频格式 set video outputformat
     * @param {string} outputformat 
     */
    setOutputFormat (outputformat) {
        if (outputformat) this.OUTPUTFORMAT = outputformat
        return this
    }

    setTimeMark (time) {
        const timePattern = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d).[0-9]{2}$/
        if (time && timePattern.test(time)) {
            this.TIMEMARK = time
        }
        return this
    }

    /**
     * @description 通过ffmpeg.ffprobe获取视频的格式
     * @param {String} url
     * @return {Promise<m3u8|unknown>} 
     * @memberof FfmpegHelper
     */
    checkUrlContentType (url, USER_AGENT) {
        // 既然可以通过ffmpeg.ffprobe获取到视频的格式和时长，那么可以通过这个方法来判断视频的格式
        return new Promise((resolve) => {
            try {
                // prefetch media need carry User-Agent
                ffmpeg.ffprobe(url, ['-user_agent', `${USER_AGENT}`], (err, metadata) => {
                    if (err) {
                        resolve('unknown')
                    } else {
                        const format = metadata && metadata.format
                        const format_name = format ? format.format_name : undefined
                        const duration = format ? format.duration : undefined
                        this.duration = duration ?? 0
                        log.info(`Format: ${format_name}, Duration: ${duration}s`)
                        if (format_name === 'hls') {
                            resolve('m3u8')
                        } else if (format_name && format_name.split(',').includes('mp4')) {
                            resolve('mp4')
                        } else {
                            resolve('unknown')
                        }
                    }
                })
            } catch {
                resolve('unknown')
            }
        })
    }

    /**
      * @description 获取地址协议
      * @param {string} url
      * @returns {("live" | "m3u8" | "mp4" | "unknown")}
      */
    async getProtocol (url, USER_AGENT) {
        switch (true) {
            // 如果地址是 rtmp rtsp 开头的，那么就是直播流
            case url.startsWith('rtmp://'):
            case url.startsWith('rtsp://'):
                return 'live'
            case url.indexOf('.m3u8') !== -1:
            case url.indexOf('.flv') !== -1:
                return 'm3u8'
            default:
                // 通过ffmpeg.ffprobe获取到视频的格式和时长，那么可以通过这个方法来判断视频的格式
                return await this.checkUrlContentType(url, USER_AGENT)
        }
    }

    /**
     * @description 获取输入文件的元数据 Gets the metadata of the input file.
     * @returns {Promise<void>} A promise that resolves when the metadata is retrieved.
     */
    async getMetadata () {
        this.PROTOCOL_TYPE = await this.getProtocol(this.INPUT_FILE, this.USER_AGENT)
    }

    /**
     * @description 测试网络连接并获取元数据（整合方法，减少 ffprobe 调用）
     * @returns {Promise<boolean>} 
     */
    async testConnectionAndGetMetadata() {
        return new Promise((resolve) => {
            try {
                const USER_AGENT = this.USER_AGENT || DEFAULT_USER_AGENT
                log.info(`Test network connection and get metadata: ${this.INPUT_FILE}`)
                
                // 首先检查是否是直播流，如果是则跳过 ffprobe
                if (this.INPUT_FILE.startsWith('rtmp://') || this.INPUT_FILE.startsWith('rtsp://')) {
                    this.PROTOCOL_TYPE = 'live'
                    log.info('Detected live stream, skipping ffprobe')
                    resolve(true)
                    return
                }
                
                // 检查是否是明显的 m3u8 或 flv 文件
                if (this.INPUT_FILE.indexOf('.m3u8') !== -1 || this.INPUT_FILE.indexOf('.flv') !== -1) {
                    this.PROTOCOL_TYPE = 'm3u8'
                    log.info('Detected m3u8/flv format from URL')
                    resolve(true)
                    return
                }
                
                // 使用 ffprobe 一次性获取所有需要的信息
                ffmpeg.ffprobe(this.INPUT_FILE, [
                    '-v',
                    'error',
                    '-user_agent',
                    USER_AGENT,
                    '-timeout',
                    '15000000', // 15 seconds
                    '-show_entries',
                    'format=format_name,duration',
                    '-show_streams',
                ], (err, metadata) => {
                    if (err) {
                        log.error('Network connection and metadata test failed:', err.message)
                        // 设置默认值并继续
                        this.PROTOCOL_TYPE = 'unknown'
                        this.duration = 0
                        log.warn('Network connection test failed, but will continue to try to download...')
                        resolve(true)
                    } else {
                        log.info('Network connection test successful')
                        
                        // 处理元数据
                        const format = metadata && metadata.format
                        const format_name = format ? format.format_name : undefined
                        const duration = format ? format.duration : undefined
                        
                        // 设置持续时间
                        this.duration = duration ?? 0
                        
                        // 确定协议类型
                        if (format_name === 'hls') {
                            this.PROTOCOL_TYPE = 'm3u8'
                        } else if (format_name && format_name.split(',').includes('mp4')) {
                            this.PROTOCOL_TYPE = 'mp4'
                        } else {
                            this.PROTOCOL_TYPE = 'unknown'
                        }
                        
                        log.info(`Detected format: ${format_name}, duration: ${duration}s, ` +
                                 `protocol: ${this.PROTOCOL_TYPE}`)
                        resolve(true)
                    }
                })
            } catch (error) {
                log.error('Network connection and metadata test failed:', error)
                // 设置默认值并继续
                this.PROTOCOL_TYPE = 'unknown'
                this.duration = 0
                log.warn('Network connection test failed, but will continue to try to download...')
                resolve(true)
            }
        })
    }

    /**
     * @description 将 headers 转换为 ffmpeg的 input options
     */
    headersToOptions (headers) {
        return headers.reduce((pre, val, index) => {
            const [key, value] = val
            if (!key || !value) return pre
            if (index === headers.length - 1)  return pre + `${key}: ${value};`
            else return pre + `${key}: ${value};\r\n`
        }, '')
    }

    optionsHaveKey (key, options) {
        if (typeof key !== 'string') return false
        return options.some((option) => {
            const [k, v] = option
            // options 内存在 key 并且 value 不为空，那么返回 true  
            // key对比统一转换为大写对比
            if (key.toUpperCase() === k.toUpperCase() && v) return true
            return false
        })
    }
    /**
     * @description 设置 ffmpeg 输入配置  Sets the input options for ffmpeg.
     */
    setInputOption () {
        try {
            // rtmp/rtsp 直播无法通过该方式设置
            if (['rtsp://', 'rtmp://'].some(prefix => this.INPUT_FILE.startsWith(prefix))) {
                // RTSP 流优化参数
                this.ffmpegCmd.inputOption('-rtsp_transport', 'tcp')  // 使用 TCP 传输，更稳定
                this.ffmpegCmd.inputOption('-buffer_size', '1024000') // 增加缓冲区大小
                this.ffmpegCmd.inputOption('-probesize', '32M')       // 增加探测大小
                this.ffmpegCmd.inputOption('-analyzeduration', '0')   // 减少分析时间
                return
            }

            // 先检查 headers 是否存在
            const headers = this.HEADERS.map((item) => [item.key, item.value])
            
            // 设置基本请求头
            if (!this.optionsHaveKey('user-agent', headers)) {
                const USER_AGENT = this.USER_AGENT || DEFAULT_USER_AGENT
                headers.push(['user-agent', USER_AGENT])
            }
            if (!this.optionsHaveKey('referer', headers)) {
                const referer = new URL(this.INPUT_FILE)?.origin
                if (referer && !['unknown', 'null'].includes(referer)) {
                    headers.push(['referer', referer])
                }
            }

            // 设置 cookie
            if (this.optionsHaveKey('cookie', headers)) {
                const cookieIndex = headers.findIndex((item) => item[0].toUpperCase() === 'COOKIE')
                if (cookieIndex !== -1) {
                    this.ffmpegCmd.inputOption('-cookies', `"${headers[cookieIndex][1]}"`)
                    headers.splice(cookieIndex, 1)
                }
            }

            // 设置其他请求头
            const headerString = this.headersToOptions(headers)
            log.verbose('Input headers:' + headerString)
            this.ffmpegCmd.inputOption('-headers', headerString)

            // 添加重试和超时设置 - 只使用最基本的选项
            this.ffmpegCmd.inputOption('-timeout', '30000000') // 30 seconds timeout
            
            // 对于 HLS 流添加重连选项（使用 PROTOCOL_TYPE 判断更准确）
            if (this.PROTOCOL_TYPE === 'm3u8') {
                this.ffmpegCmd.inputOption('-reconnect', '1')
                this.ffmpegCmd.inputOption('-reconnect_at_eof', '1')
                this.ffmpegCmd.inputOption('-reconnect_delay_max', '4')
                // 设置获取最高分辨率视频

            }
        } catch (error) {
            log.error('Error setting input options:', error)
            throw error
        }
    }

    /**
     * @description 设置输出选项
     */
    setOutputOption() {
        try {
            // 设置线程数
            if (this.THREADS) {
                this.ffmpegCmd.outputOptions([
                    `-threads ${this.THREADS}`,
                ])
            }

            if (this.TIMEMARK) {
                this.ffmpegCmd.seekInput(this.TIMEMARK)
            }

            // 设置输出的质量
            this.ffmpegCmd.outputOptions(`-preset ${this.PRESET || 'veryfast'}`)

            // 添加错误处理和恢复选项
            this.ffmpegCmd.outputOptions('-err_detect ignore_err')
            this.ffmpegCmd.outputOptions('-fflags +genpts+igndts')
            this.ffmpegCmd.outputOptions('-max_error_rate 0.0')

            // 获取硬件加速信息
            const hwAccelInfo = this.hwAccelInfo

            // PROTOCOL_TYPE为预留字段
            const liveProtocol = this.PROTOCOL_TYPE
            switch (liveProtocol) {
                case 'live':
                    this.setLiveStreamOptions(hwAccelInfo)
                    break
                default:
                    this.setRegularStreamOptions(hwAccelInfo)
                    break
            }

            // 添加队列和内存管理选项
            this.ffmpegCmd.outputOptions('-max_muxing_queue_size 1024')
            this.ffmpegCmd.outputOptions('-max_alloc 50000000')
        } catch (error) {
            log.error('Error setting output options:', error)
            throw error
        }
    }

    /**
     * @description 设置直播流选项
     * @param {Object|null} hwAccelInfo 硬件加速信息
     */
    setLiveStreamOptions(hwAccelInfo) {
        if (hwAccelInfo) {
            log.info(`Using hardware acceleration for live stream: ${hwAccelInfo.desc}`)
            
            // 添加硬件加速输入选项（如果需要）
            if (hwAccelInfo.hwaccel && hwAccelInfo.hwaccel !== 'auto') {
                this.ffmpegCmd.inputOption('-hwaccel', hwAccelInfo.hwaccel)
            }
            
            // 使用硬件加速编码
            this.ffmpegCmd
            .outputOptions(`-c:v ${this.hardwareAccel}`)
            .outputOptions('-c:a copy')
            .outputOptions('-b:v 0')  // 自动选择最佳比特率
            .output(this.OUTPUT_FILE)
        } else {
            log.info('Using software encoding for live stream')
            // 使用软件编码
            this.ffmpegCmd
            .outputOptions('-c:v copy')
            .outputOptions('-c:a copy')
            .output(this.OUTPUT_FILE)
        }
    }

    /**
     * @description 设置常规流选项
     * @param {Object|null} hwAccelInfo 硬件加速信息
     */
    setRegularStreamOptions(hwAccelInfo) {
        if (hwAccelInfo) {
            log.info(`Using hardware acceleration for regular stream: ${hwAccelInfo.desc}`)
            
            // 添加硬件加速输入选项（如果需要）
            if (hwAccelInfo.hwaccel && hwAccelInfo.hwaccel !== 'auto') {
                this.ffmpegCmd.inputOption('-hwaccel', hwAccelInfo.hwaccel)
            }
            
            // 使用硬件加速编码
            this.ffmpegCmd
            .outputOptions(`-c:v ${this.hardwareAccel}`)
            .outputOptions('-c:a copy')
            .outputOptions('-b:v 0')
            .output(this.OUTPUT_FILE)
        } else {
            log.info('Using software encoding for regular stream')
            // 使用软件编码
            this.ffmpegCmd
            .outputOptions('-c:v copy')
            .outputOptions('-c:a copy')
            .output(this.OUTPUT_FILE)
        }
    }

    handlerProcess (progress, callback) {
        
        if (!callback || typeof callback !== 'function') {
            log.warn('Callback is not a function or not provided in handlerProcess')
            return
        }
        
        const toFixed = (val, precision = 1) => {
            const multiplier = 10 ** precision
            return Math.round(val * multiplier) / multiplier
        }
        const formatFileSize = (fileSizeKb) => {
            const fileSizeMb = fileSizeKb / 1024
            const fileSizeGb = fileSizeMb / 1024

            if (fileSizeGb >= 1) {
                const speedGbps = fileSizeGb.toFixed(2)
                return `${speedGbps} GB`
            } else if (fileSizeMb >= 1) {
                const speedMbps = fileSizeMb.toFixed(2)
                return `${speedMbps} MB`
            } else {
                const speedKbps = fileSizeKb.toFixed(2)
                return `${speedKbps} KB`
            }
        }
        const formatSpeed = (speedKbps) => {
            const speedMbps = speedKbps / 1000
            const speedGbps = speedMbps / 1000
            if (speedGbps >= 1) {
                return `${speedGbps.toFixed(2)} Gb/s`
            } else if (speedMbps >= 1) {
                return `${speedMbps.toFixed(2)} Mb/s`
            } else {
                return `${speedKbps.toFixed(2)} Kb/s`
            }
        }
        const timemarkToSeconds = (timemark) => {
            // 通过冒号将时间戳拆分为时、分、秒和小数秒
            const [hours, minutes, seconds, decimals] = timemark.split(':')

            // 将时、分、秒转换为整数
            const hoursInSeconds = parseInt(hours, 10) * 3600
            const minutesInSeconds = parseInt(minutes, 10) * 60
            const secondsInSeconds = parseInt(seconds, 10)

            // 将小数秒转换为浮点数
            const decimalsInSeconds = parseFloat(`0.${decimals}`)

            // 计算总秒数
            const totalSeconds = hoursInSeconds + minutesInSeconds + secondsInSeconds + decimalsInSeconds

            return totalSeconds
        }
        this.downloadedBytes = progress.targetSize
        const elapsedSeconds = (Date.now() - this.startTime) / 1000
        const averageSpeedKbps = this.downloadedBytes / elapsedSeconds
        const currentMbs = formatSpeed(averageSpeedKbps)
        let percent = progress.percent 
            ? toFixed(progress.percent * 100) / 100 
            : toFixed((timemarkToSeconds(progress.timemark) / this.duration) * 100)
        
        if (Number.isNaN(percent)) {
            log.info('Percent is NaN, setting protocol type to live')
            this.PROTOCOL_TYPE = 'live'
        }
        
        try {
            const protocolType = Number.isNaN(percent) ? 'live' : this.PROTOCOL_TYPE
            const params = {
                percent: percent >= 100 ? 100 : percent,
                currentMbs,
                timemark: progress.timemark,
                targetSize: formatFileSize(progress.targetSize),
                protocolType,
                isLive: Number.isNaN(percent),
            }
            callback(params)
        } catch (error) {
            log.error('Error in progress callback:', error)
        }
    }

    /**
    * @description 开始下载任务
    * @param {Function} listenProcess 监听下载进度的回调函数
    * @returns {Promise}
    */
    start(listenProcess) {
        return new Promise((resolve, reject) => {
            const self = this
            ;(async () => {
                try {
                    // 检查 FFmpeg 兼容性
                    const isCompatible = await self.checkFFmpegCompatibility()
                    if (!isCompatible) {
                        throw new Error('FFmpeg compatibility check failed')
                    }
                    // 检查硬件加速
                    self.hwAccelInfo = await hardWareDetect.getHardwareAccel()
                    if (self.hwAccelInfo) {
                        self.hardwareAccel = self.hwAccelInfo?.encoder
                    }
                    if (self.hardwareAccel) {
                        log.info(`Using hardware acceleration: ${self.hardwareAccel}`)
                    } else {
                        log.info('No hardware acceleration available, using software encoding')
                    }

                    if (!self.INPUT_FILE || !self.OUTPUT_FILE) {
                        throw new Error('You must specify the input and the output files')
                    }

                    // 整合的网络测试和元数据获取
                    log.info('Start testing network connection and getting metadata...')
                    const testResult = await self.testConnectionAndGetMetadata()
                    if (!testResult) {
                        throw new Error('Network connection and metadata test failed')
                    }

                    self.ffmpegCmd = ffmpeg(self.INPUT_FILE)
                    self.setInputOption()
                    
                    if (self.INPUT_AUDIO_FILE) {
                        self.ffmpegCmd.input(self.INPUT_AUDIO_FILE)
                    }

                    await self.setOutputOption()

                    self.ffmpegCmd
                    .on('progress', (progress) => {
                        if (!listenProcess || typeof listenProcess !== 'function') {
                            log.warn('Progress callback is not a function or not provided')
                            return
                        }
                        self.handlerProcess(progress, listenProcess)
                    })
                    .on('stderr', function (stderrLine) {
                        log.verbose(`${stderrLine}`)
                    })
                    .on('start', function (commandLine) {
                        self.startTime = Date.now()
                        log.info(`FFmpeg exec command: ${commandLine}`)
                    })
                    .on('error', (error) => {
                        self.handleFFmpegError(error)
                        reject(error)
                    })

                    .on('end', () => {
                        log.verbose(`Finish mission: ${self.INPUT_FILE}`)
                        resolve('')
                    })

                    self.ffmpegCmd.run()
                } catch (e) {
                    log.error('Error in start method:', e)
                    reject(e)
                }
            })()
        })
    }

    /**
   * @description  杀掉 ffmepg 进程  Kills the ffmpeg process.
   * @param {string} signal The signal to send to the process.
   */
    kill (signal) {
        // SIGINT 中止录制：除了该方式中断其他方式中断的视频无法播放
        // SIGSTOP 挂起ffmpeg
        // SIGCONT 恢复下载
        // SIGKILL 杀死进程
        log.info(`kill process with signal: ${signal}`)
        try {
            if (signal) this.ffmpegCmd.ffmpegProc?.kill(signal)
            else if (this.PROTOCOL_TYPE === 'live') {
                this.ffmpegCmd.ffmpegProc?.kill('SIGINT')
            } else {
                this.ffmpegCmd.ffmpegProc?.kill('SIGINT')
            }
        } catch (e) {
            log.error('error happend in kill process: ', e)
        } 
    }

    /**
     * @description 获取简化的文件名（用于报告文件命名）
     * @param {string} filePath 文件路径或URL
     * @returns {string} 简化的文件名
     */
    getSimplifiedFileName(filePath) {
        try {
            // 移除查询参数和片段
            const cleanUrl = filePath.split('?')[0].split('#')[0]
            // 获取文件名部分
            const fileName = cleanUrl.split('/').pop() || 'unknown'
            // 移除特殊字符，只保留字母数字和连字符下划线点
            return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50)
        } catch {
            return 'unknown'
        }
    }

    /**
     * @description 清理旧的报告文件
     * @param {number} daysToKeep 保留天数，默认30天
     */
    static cleanupReports(daysToKeep = 30) {
        try {
            const now = Date.now()
            const keepDuration = daysToKeep * 24 * 60 * 60 * 1000 // 转换为毫秒
            
            const reportDirs = ['error-reports', 'success-reports']
            let cleanedCount = 0
            
            reportDirs.forEach(dirName => {
                const reportDir = path.join(process.cwd(), dirName)
                if (fs.existsSync(reportDir)) {
                    const files = fs.readdirSync(reportDir)
                    files.forEach(file => {
                        if (file.endsWith('.json')) {
                            const filePath = path.join(reportDir, file)
                            const stats = fs.statSync(filePath)
                            const fileAge = now - stats.mtime.getTime()
                            
                            if (fileAge > keepDuration) {
                                fs.unlinkSync(filePath)
                                cleanedCount++
                            }
                        }
                    })
                }
            })
            
            console.log(`Cleaned up ${cleanedCount} old report files`)
        } catch (error) {
            console.error('Failed to cleanup reports:', error)
        }
    }

}
module.exports = FfmpegHelper