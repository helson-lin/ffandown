/* eslint-disable camelcase */
/**
 * @description M3U8 to MP4 Converter
 * @author Furkan Inanc, Helson Lin
 * @version 1.0.0
 */
const ffmpeg = require('fluent-ffmpeg')
const { LOG: log } = require('../utils/index')
/**
  * A class to convert M3U8 to MP4
  * @class
  */
class FfmpegHelper {
    PRESET
    OUTPUTFORMAT
    USER_AGENT
    THREADS
    M3U8_FILE
    VERBOSE
    PROTOCOL_TYPE
    duration
    constructor (options) {
        if (options?.THREADS) this.THREADS = options.THREADS
        if (options?.VERBOSE) log.level = options.VERBOSE ? 'verbose' : 'silent'
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
      * @returns {Function}
      */
    setInputFile (M3U8_FILE) {
        if (!M3U8_FILE) throw new Error('You must specify the M3U8 file address')
        this.M3U8_FILE = M3U8_FILE
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
        this.PROTOCOL_TYPE = await this.getProtocol(this.M3U8_FILE, this.USER_AGENT)
    }

    /**
     * @description 设置 ffmpeg 输入配置  Sets the input options for ffmpeg.
     */
    setInputOption () {
        const USER_AGENT = this.USER_AGENT || 
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36'
        const REFERER_RGX = /^(?<referer>http|https:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+)(?::\d+)?\/[^ "]+$/u
        const match = this.M3U8_FILE.match(REFERER_RGX)
        const [referer] = match === null ? ['unknown'] : match.slice(1)
        const options = []
        // 设置用户代理
        if (USER_AGENT) options.push('-user_agent', `${USER_AGENT}`)
        // 如果存在 referer 设置 referer
        if (referer !== 'unknown') options.push('-referer', `${referer}`)
        options.length && this.ffmpegCmd.inputOptions(options)
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
            const _this = this;
            (async () => {
                if (!_this.M3U8_FILE || !_this.OUTPUT_FILE) {
                    reject(new Error('You must specify the input and the output files'))
                } else {
                    await _this.getMetadata()
                    _this.ffmpegCmd = ffmpeg(_this.M3U8_FILE)
                    _this.setInputOption()
                    // setOutputOption is dependen on protocol type
                    await _this.setOutputOption()
                    // set the transform file suffix
                    // _this.ffmpegCmd.format(_this.OUTPUTFORMAT || 'mp4')
                    _this.ffmpegCmd
                    .on('progress', (progress) => {
                        _this.handlerProcess(progress, listenProcess)
                    })
                    .on('stderr', function (stderrLine) {
                        log.verbose('Stderr output:' + stderrLine)
                    })
                    .on('start', function (commandLine) {
                        _this.startTime = Date.now()
                        log.verbose('FFmpeg exec command: ' + commandLine)
                    })
                    .on('error', (error) => {
                        log.error('FFmpeg error happed: ' + error)
                        reject(error)
                    })
                    .on('end', () => {
                        log.verbose(`finish mission: ${_this.M3U8_FILE}`)
                        resolve('')
                    })
                    .run()
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
            if (signal) this.ffmpegCmd.ffmpegProc.kill(signal)
            else if (this.PROTOCOL_TYPE === 'live') {
                this.ffmpegCmd.ffmpegProc.kill('SIGINT')
            } else {
                this.ffmpegCmd.ffmpegProc.kill('SIGINT')
            }
        } catch (e) {
            log.error('error happend in kill process: ', e)
        } 
    }
}
module.exports = FfmpegHelper