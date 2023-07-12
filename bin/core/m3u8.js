/**
 * @description M3U8 to MP4 Converter
 * @author Furkan Inanc, Helson Lin
 * @version 1.0.0
 */
const ffmpeg = require('fluent-ffmpeg')
/**
 * A class to convert M3U8 to MP4
 * @class
 */
class m3u8ToMp4Converter {
    /**
     * Sets the input file
     * @param {String} filename M3U8 file path. You can use remote URL
     * @returns {Function}
     */
    setInputFile (filename) {
        if (!filename) throw new Error('You must specify the M3U8 file address')
        this.M3U8_FILE = filename
        this.PROTOCOL_TYPE = this.getProtocol(this.M3U8_FILE)
        return this
    }

    /**
   * Sets the output file
   * @param {String} filename Output file path. Has to be local :)
   * @returns {Function}
   */
    setOutputFile (filename) {
        if (!filename) throw new Error('You must specify the file path and name')
        this.OUTPUT_FILE = filename

        return this
    }

    /**
   * Sets the thread
   * @param {Number} number thread number
   * @returns {Function}
   */
    setThreads (number) {
        if (number) {
            this.THREADS = number
        }
        return this
    }

    setTimeMark (time) {
        // TODO: check params is correct
        const timePattern = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d).[0-9]{2}$/
        if (time && timePattern.test(time)) {
            this.TIMEMARK = time
        }
        return this
    }

    /**
     * 获取地址协议
     * @date 3/30/2023 - 11:50:14 AM
     * @author hejianglin
     * @param {*} url
     * @returns {("live" | "m3u8" | "mp4" | "unknown")}
     */
    getProtocol (url) {
        console.log(url, url.indexOf('m3u8') !== -1)
        switch (true) {
            case url.startsWith('rtmp://'):
            case url.startsWith('rtsp://'):
                return 'live'
            case url.indexOf('m3u8') !== -1:
                return 'm3u8'
            default:
                return 'unknown'
        }
    }

    setInputOption () {
        // eslint-disable-next-line max-len
        const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36',
            REFERER_RGX = /^(?<referer>http|https:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+)(?::\d+)?\/[^ "]+$/u,
            match = this.M3U8_FILE.match(REFERER_RGX),
            [referer] = match === null ? ['unknown'] : match.slice(1)
        this._ffmpegCmd.inputOptions(
            [
                '-user_agent',
                `${USER_AGENT}`,
                '-referer',
                `${referer}/`,
            ],
        )
    }

    setOutputOption () {
        // set thread Transcoding
        if (this.THREADS) {
            this._ffmpegCmd.outputOptions(`-threads ${this.THREADS}`)
            this._ffmpegCmd.outputOptions('-preset ultrafast')
        }
        // 断点续传
        if (this.TIMEMARK) {
            this._ffmpegCmd.outputOptions(`-ss ${this.TIMEMARK}`)
        }
        // diffrent type set diffrent download 
        const liveProtocol = this.PROTOCOL_TYPE
        if (liveProtocol === 'live') {
            this._ffmpegCmd.outputOptions('-c:v copy')
            .outputOptions('-c:a aac')
            .outputOptions('-b:a 128k')
            .output(this.OUTPUT_FILE)
        } else if (liveProtocol === 'm3u8') {
            this._ffmpegCmd
            .outputOptions('-c:v copy')
            .outputOptions('-bsf:a aac_adtstoasc')
            .output(this.OUTPUT_FILE)
        }
    }

    monitorProcess (callback) {
        this._ffmpegCmd.ffprobe((err, data) => {
            if (err) {
                console.log(`Error: ${err.message}`)
                return
            }
            const toFixed = (val, precision = 1) => {
                const multiplier = Math.pow(10, precision)
                return Math.round(val * multiplier) / multiplier 
            }
            const duration = data.format.duration
            this._ffmpegCmd
            .on('progress', (progress) => {
                console.log(progress)
                const percent = (progress.percent * 100) / 100
                const processedDuration = duration * (progress.percent / 100)
                const remainingDuration = duration - processedDuration
                const currentMbs = progress.currentKbps / 1000
                if (callback && typeof callback === 'function') {
                    const params = {
                        percent: toFixed(percent),
                        process: toFixed(processedDuration),
                        remaining: toFixed(remainingDuration),
                        currentMbs: toFixed(currentMbs, 2) + 'Mb/s',
                        timemark: progress.timemark,
                        targetSize: progress.targetSize,
                    }
                    callback(params)
                }
            })
            .run()
        })
    }

    /**
     * Starts the process
     */
    start (listenProcess) {
        return new Promise((resolve, reject) => {
            if (!this.M3U8_FILE || !this.OUTPUT_FILE) {
                reject(new Error('You must specify the input and the output files'))
                return
            }
            if (this.PROTOCOL_TYPE === 'unknown') {
                reject(new Error('the protocol is not supported, please specify the protocol type: m3u8 or rtmp、 rtsp'))
            }
            this._ffmpegCmd = ffmpeg(this.M3U8_FILE)
            this._ffmpegCmd
            .on('error', error => {
                reject(new Error(error))
            })
            .on('end', () => {
                resolve()
            })
            this.setInputOption()
            this.setOutputOption()
            this.monitorProcess(listenProcess)
            this._ffmpegCmd.run()
        })
    }
}

module.exports = m3u8ToMp4Converter
