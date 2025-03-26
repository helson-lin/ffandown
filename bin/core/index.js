/* eslint-disable camelcase */
/**
 * @description M3U8 to MP4 Converter
 * @author Furkan Inanc, Helson Lin
 * @version 1.0.0
 */
const ffmpeg = require('fluent-ffmpeg')
const { LOG: log } = require('../utils/index')

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
    constructor (options) {
        if (options?.THREADS) this.THREADS = options.THREADS
        this.HEADERS = []
        this.downloadedBytes = 0
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
        // rtmp/rtsp 直播无法通过该方式设置
        if (['rtsp://', 'rtmp://'].some(prefix => this.INPUT_FILE.startsWith(prefix))) return
        // 先检查 headers 是否存在
        log.verbose('HEADERS:' + JSON.stringify(this.HEADERS))
        const headers = this.HEADERS.map((item) => [item.key, item.value])
        if (!this.optionsHaveKey('user-agent', headers)) {
            // 如果请求头内没有用户代理，那么设置用户代理
            const USER_AGENT = this.USER_AGENT || DEFAULT_USER_AGENT
            headers.push(['user-agent', USER_AGENT])
        }
        if (!this.optionsHaveKey('referer', headers)) {
            // 如果请求头内没有 referer，那么设置 referer
            const referer = new URL(this.INPUT_FILE)?.origin
            if (referer && !['unknown', 'null'].includes(referer)) headers.push(['referer', referer])
        }
        // cookie 通过 -cookies 设置
        if (this.optionsHaveKey('cookie', headers)) {
            const cookieIndex = headers.findIndex((item) => item[0].toUpperCase() === 'COOKIE')
            this.ffmpegCmd.inputOption('-cookies', `"${headers[cookieIndex][1]}"`)
            if (cookieIndex !== -1) headers.splice(cookieIndex, 1)
        }
        let headerString = this.headersToOptions(headers)
        log.verbose('headers:' + headerString)
        // 通过 ffmpeg.inputOption 设置 headers
        this.ffmpegCmd.inputOption(
            '-headers', headerString,
        )
    }

    /**
   * Sets the output options for ffmpeg.
   */
    setOutputOption () {
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
        // PROTOCOL_TYPE为预留字段
        const liveProtocol = this.PROTOCOL_TYPE
        switch (liveProtocol) {
            default:
                this.ffmpegCmd
                .outputOptions('-c:v copy')
                .outputOptions('-c:a copy')
                .output(this.OUTPUT_FILE)
                break
        }
        this.ffmpegCmd.outputOptions('-v debug')
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
                    if (!self.INPUT_FILE || !self.OUTPUT_FILE) {
                        reject(new Error('You must specify the input and the output files'))
                    } else {
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
                            log.verbose('Stderr output: ' + stderrLine)
                        })
                        .on('start', function (commandLine) {
                            self.startTime = Date.now()
                            log.verbose(`FFmpeg exec command: "${commandLine}"`)
                        })
                        .on('error', (error) => {
                            log.error('FFmpeg error happed: ' + error)
                            reject(error)
                        })
                        .on('end', () => {
                            log.verbose(`finish mission: ${self.INPUT_FILE}`)
                            resolve('')
                        })
                        .run()
                    }
                } catch (e) {
                    log.error(e)
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
        log.verbose(`kill process with signal: ${signal}`)
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