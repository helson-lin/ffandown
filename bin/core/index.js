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
    hardwareAccel = null
    systemInfo = null
    constructor (options) {
        if (options?.THREADS) this.THREADS = options.THREADS
        this.HEADERS = []
        this.downloadedBytes = 0
        this.collectSystemInfo()
        this.detectHardwareAccel()
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
            return execSync('ffmpeg -version').toString().split('\n')[0]
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
                // 检查基本功能
                ffmpeg.ffprobe('-v', 'error', '-version', (err) => {
                    if (err) {
                        log.error('FFmpeg compatibility check failed:', err)
                        resolve(false)
                        return
                    }

                    // 检查编码器支持
                    ffmpeg.ffprobe('-v', 'error', '-encoders', (err, data) => {
                        if (err) {
                            log.error('Failed to check encoders:', err)
                            resolve(false)
                            return
                        }

                        // 检查解码器支持
                        ffmpeg.ffprobe('-v', 'error', '-decoders', (err, data) => {
                            if (err) {
                                log.error('Failed to check decoders:', err)
                                resolve(false)
                                return
                            }

                            resolve(true)
                        })
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
        const report = {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                stack: error.stack,
                code: error.code,
            },
            systemInfo: this.systemInfo,
            ffmpegCommand: this.ffmpegCmd ? this.ffmpegCmd._currentCommand : 'Not available',
            inputFile: this.INPUT_FILE,
            outputFile: this.OUTPUT_FILE,
            hardwareAccel: this.hardwareAccel,
            protocolType: this.PROTOCOL_TYPE,
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

        // 保存诊断报告到文件
        try {
            const reportPath = path.join(process.cwd(), 'ffmpeg-error-report.json')
            fs.writeFileSync(reportPath, diagnosticReport)
            log.info(`Diagnostic report saved to: ${reportPath}`)
        } catch (writeError) {
            log.error('Failed to save diagnostic report:', writeError)
        }
    }

    /**
     * @description 检测系统支持的硬件加速
     * @returns {Promise<void>}
     */
    async detectHardwareAccel() {
        return new Promise((resolve) => {
            // 首先检查 ffmpeg 是否支持硬件加速
            ffmpeg.ffprobe('-v', 'error', '-hwaccels', (err, data) => {
                if (err) {
                    log.warn('Failed to detect hardware acceleration support')
                    resolve()
                    return
                }

                // 检测支持的硬件加速
                const hwAccels = [
                    { name: 'h264_nvenc', desc: 'NVIDIA GPU' },
                    { name: 'h264_videotoolbox', desc: 'Apple VideoToolbox' },
                    { name: 'h264_vaapi', desc: 'VAAPI' },
                    { name: 'h264_qsv', desc: 'Intel Quick Sync' }
                ]

                let detected = false
                const checkNextAccel = (index) => {
                    if (index >= hwAccels.length) {
                        if (!detected) {
                            log.info('No hardware acceleration available, using software encoding')
                        }
                        resolve()
                        return
                    }

                    const accel = hwAccels[index]
                    ffmpeg.ffprobe('-v', 'error', '-f', accel.name, '-i', 'dummy', (err) => {
                        if (!err) {
                            this.hardwareAccel = accel.name
                            log.info(`Hardware acceleration detected: ${accel.desc} (${accel.name})`)
                            detected = true
                            resolve()
                        } else {
                            checkNextAccel(index + 1)
                        }
                    })
                }

                checkNextAccel(0)
            })
        })
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
        log.verbose('setInputAudioFile: ' + INPUT_FILE)
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
                        log.verbose('format_name: ' + format_name + ' duration: ' + duration)
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
            if (['rtsp://', 'rtmp://'].some(prefix => this.INPUT_FILE.startsWith(prefix))) return

            // 先检查 headers 是否存在
            log.verbose('HEADERS:' + JSON.stringify(this.HEADERS))
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
            log.verbose('headers:' + headerString)
            this.ffmpegCmd.inputOption('-headers', headerString)

            // 添加重试和超时设置
            this.ffmpegCmd.inputOption('-reconnect', '1')
            this.ffmpegCmd.inputOption('-reconnect_at_eof', '1')
            this.ffmpegCmd.inputOption('-reconnect_streamed', '1')
            this.ffmpegCmd.inputOption('-reconnect_delay_max', '2')
            this.ffmpegCmd.inputOption('-timeout', '5000000') // 5 seconds timeout
        } catch (error) {
            log.error('Error setting input options:', error)
            throw error
        }
    }

    /**
   * Sets the output options for ffmpeg.
   */
    setOutputOption () {
        try {
            // 设置线程数
            if (this.THREADS) {
                this.ffmpegCmd.outputOptions([
                    `-threads ${this.THREADS}`,
                    '-max_muxing_queue_size 9999',
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

            // PROTOCOL_TYPE为预留字段
            const liveProtocol = this.PROTOCOL_TYPE
            switch (liveProtocol) {
                default:
                    if (this.hardwareAccel) {
                        // 使用硬件加速
                        this.ffmpegCmd
                            .outputOptions(`-c:v ${this.hardwareAccel}`)
                            .outputOptions('-c:a copy')
                            .outputOptions('-b:v 0') // 使用硬件加速时自动选择最佳比特率
                            .output(this.OUTPUT_FILE)
                    } else {
                        // 使用软件编码
                        this.ffmpegCmd
                            .outputOptions('-c:v copy')
                            .outputOptions('-c:a copy')
                            .output(this.OUTPUT_FILE)
                    }
                    break
            }

            // 设置日志级别
            this.ffmpegCmd.outputOptions('-v warning')

            // 添加内存使用限制
            this.ffmpegCmd.outputOptions('-max_muxing_queue_size 9999')
            this.ffmpegCmd.outputOptions('-thread_queue_size 1024')
            
            // 添加错误恢复选项
            this.ffmpegCmd.outputOptions('-err_detect ignore_err')
            this.ffmpegCmd.outputOptions('-fflags +genpts+igndts')
            this.ffmpegCmd.outputOptions('-max_error_rate 0.0')
            
            // 添加内存管理选项
            this.ffmpegCmd.outputOptions('-max_alloc 50000000') // 限制最大内存分配
            this.ffmpegCmd.outputOptions('-max_muxing_queue_size 1024')
        } catch (error) {
            log.error('Error setting output options:', error)
            throw error
        }
    }

    handlerProcess (progress, callback) {
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
        // let startTime = Date.now()
        this.downloadedBytes = progress.targetSize
        const elapsedSeconds = (Date.now() - this.startTime) / 1000
        const averageSpeedKbps = this.downloadedBytes / elapsedSeconds
        const currentMbs = formatSpeed(averageSpeedKbps)
        let percent = progress.percent 
            ? toFixed(progress.percent * 100) / 100 
            : toFixed((timemarkToSeconds(progress.timemark) / this.duration) * 100)
        if (Number.isNaN(percent)) this.PROTOCOL_TYPE = 'live'
        if (callback && typeof callback === 'function') {
            const params = {
                percent: percent >= 100 ? 100 : percent,
                currentMbs,
                timemark: progress.timemark,
                targetSize: formatFileSize(progress.targetSize),
                protocolType: Number.isNaN(percent) ? 'live' : 'video',
                // percent is NaN , when the link is live
                isLive: Number.isNaN(percent),
            }
            callback(params)
        }
    }

    /**
    * @description 开始下载任务 Start download mission
    * @param {Function} listenProcess 监听下载进度的回调函数 Callback function for listening to download progress
    * @returns {Promise}
    */
    start (listenProcess) {
        return new Promise((resolve, reject) => {
            const self = this;
            (async () => {
                try {
                    // 检查 FFmpeg 兼容性
                    const isCompatible = await self.checkFFmpegCompatibility()
                    if (!isCompatible) {
                        throw new Error('FFmpeg compatibility check failed')
                    }

                    if (!self.INPUT_FILE || !self.OUTPUT_FILE) {
                        throw new Error('You must specify the input and the output files')
                    }

                    await self.getMetadata()
                    self.ffmpegCmd = ffmpeg(self.INPUT_FILE)
                    self.setInputOption()
                    if (self.INPUT_AUDIO_FILE) self.ffmpegCmd.input(self.INPUT_AUDIO_FILE)
                    // setOutputOption is dependen on protocol type
                    await self.setOutputOption()
                    // set the transform file suffix
                    // self.ffmpegCmd.format(self.OUTPUTFORMAT || 'mp4')
                    self.ffmpegCmd
                    .on('progress', (progress) => {
                        self.handlerProcess(progress, listenProcess)
                    })
                    .on('stderr', function (stderrLine) {
                        log.verbose(`URL: ${self.INPUT_FILE}/StderrLine:` + stderrLine)
                    })
                    .on('start', function (commandLine) {
                        self.startTime = Date.now()
                        log.verbose(`FFmpeg exec command: "${commandLine}"`)
                    })
                    .on('error', (error) => {
                        self.handleFFmpegError(error)
                        reject(error)
                    })
                    .on('end', () => {
                        log.verbose(`Finish mission: ${self.INPUT_FILE}`)
                        resolve('')
                    })
                    .run()
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
}
module.exports = FfmpegHelper