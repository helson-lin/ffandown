const logger = require('./log')
/**
 * @description M3U8 to MP4 Converter
 * @author Furkan Inanc
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
    
    /**
     * 获取地址协议
     * @date 3/30/2023 - 11:50:14 AM
     * @author hejianglin
     * @param {*} url
     * @returns {("live" | "m3u8" | "mp4" | "unknown")}
     */
    getProtocol (url) {
        switch (true) {
            case url.startsWith('rtmp://'):
            case url.startsWith('rtsp://'):
                return 'live'
            case url.endsWith('m3u8'):
                return 'm3u8'
            default:
                return 'unknown'
        }
    }
    
    setOutputOption (ffmpegCmd) {
        const liveProtocol = this.PROTOCOL_TYPE 
        if (liveProtocol === 'live') {
            ffmpegCmd.outputOptions('-c:v copy')
            .outputOptions('-c:a aac')
            .outputOptions('-b:a 128k')
            .output(this.OUTPUT_FILE)
        } else if (liveProtocol === 'm3u8') {
            ffmpegCmd
            .outputOptions('-c:v copy')
            .outputOptions('-bsf:a aac_adtstoasc')
            .output(this.OUTPUT_FILE)
        }
    }

    /**
     * Starts the process
     */
    start () {
        return new Promise((resolve, reject) => {
            if (!this.M3U8_FILE || !this.OUTPUT_FILE) {
                reject(new Error('You must specify the input and the output files'))
                return
            }
            if (this.PROTOCOL_TYPE === 'unknown') {
                reject(new Error('the protocol is not supported, please specify the protocol type: m3u8 or rtmp、 rtsp'))
            }
            // eslint-disable-next-line max-len
            const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36',
                REFERER_RGX = /^(?<referer>http|https:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+)(?::\d+)?\/[^ "]+$/u,
                match = this.M3U8_FILE.match(REFERER_RGX),
                [referer] = match === null ? ['unknown'] : match.slice(1)
            const ffmpegCmd = ffmpeg(this.M3U8_FILE, { 
                logger: {
                    error (...args) {
                        console.log('warn:', args)
                    }, 
                    warn (...args) { 
                        console.log('warn:', args) 
                    },
                    info (...args) {
                        console.log('info', args)
                    },
                    debug (...args) {
                        console.log('info12', args)
                    },
                },
            })
            .inputOptions(
                [
                    '-user_agent',
                    `${USER_AGENT}`,
                    '-referer',
                    `${referer}/`,
                ],
            )
            .on('error', error => {
                reject(new Error(error))
            })
            .on('stderr', (stderr) => 
                logger.warn(stderr.toString().trim()))
            .on('end', () => {
                resolve()
            })
            if (this.THREADS) {
                ffmpegCmd.outputOptions(`-threads ${this.THREADS}`)
                ffmpegCmd.outputOptions('-preset ultrafast')
            }
            this.setOutputOption(ffmpegCmd)
            ffmpegCmd.run()
        })
    }
}

module.exports = m3u8ToMp4Converter
