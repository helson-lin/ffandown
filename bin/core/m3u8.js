/**
 * @description M3U8 to MP4 Converter
 * @author Furkan Inanc, Helson Lin
 * @version 1.0.0
 */
const ffmpeg = require('fluent-ffmpeg')
const os = require('os')
const colors = require('colors')
const { chmod, execCmd } = require('../utils/system')
const path = require('path')
const fse = require('fs-extra')
const download = require('download')
const REGISTORYURL = 'https://nn.oimi.space/https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1'
/**
 * A class to convert M3U8 to MP4
 * @class
 */
class m3u8ToMp4Converter {
    constructor (options) {
        const { registoryUrl, ffprobe, ffmpeg } = options
        this.registoryUrl = registoryUrl || REGISTORYURL
        this.ffprobe = ffprobe || false
        this.ffmpeg = ffmpeg || false
        this._ffmpegCmd = null
    }

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
     * @description: judege input path is a directory
     * @param {string} pathDir path 
     * @return {boolean} true: path is a file
     */
    isExist (pathDir) { return fse.pathExistsSync(pathDir) }
    /**
     * @description: get lib path
     * @param {string} componentName path 
     * @return {string} lib path
     */
    getLibPath (componentName = 'ffmpeg') {
        const executableFileSuffix = os.platform().startsWith('win') ? `${componentName}.exe` : componentName
        return path.join(process.cwd(), `lib/${executableFileSuffix}`)
    }

    async downloadAndSetEnv (url, libPath, type) {
        try {
            await download(url, 'lib', { extract: true })
            this.setEnv(type, libPath)
            await chmod(libPath)
        } catch (e) {
            console.warn('download and set env failed:' + String(e).trim())
        }
    }

    detectPlatform () {
        let type = (os.type()).toLowerCase()
        let arch = (os.arch()).toLowerCase()
      
        if (type === 'darwin') {
            return 'osx-64'
        }
      
        if (type === 'windows_nt') {
            return arch === 'x64' ? 'windows-64' : 'windows-32'
        }
      
        if (type === 'linux') {
            if (arch === 'arm' || arch === 'arm64') {
                return 'linux-armel'
            }
            return arch === 'x64' ? 'linux-64' : 'linux-32'
        }
      
        return null
    }

    /**
     * get binaries download urls
     * @param {String} component ffmpeg ffprobe
     * @returns {String} download url
     */
    getDownloadUrl (component, version = '4.4.1') {
        return `${this.registoryUrl}/${component}-${version}-${this.detectPlatform()}.zip`
    }

    /**
     * is need download
     * @param {String} type ffmpeg ffprobe
     * @returns {boolean}
     */
    needDownload (type) {
        const libPath = this.getLibPath(type)
        const isExist = this.isExist(libPath)
        if (isExist) this.setEnv(type, libPath)
        return this[type] ? !isExist : false
    }

    /**
     * @param {ffmpeg|ffprobe} type 
     * @returns 
     */
    getLibsStatus (type) {
        return {   
            type,
            libPath: this.getLibPath(type),
            downloadURL: this.getDownloadUrl(type, '4.4.1'),
            download: this.needDownload(type), 
        }
    }

    /**
     * download ffbinary
     * @param {Array} libs 
     * @returns 
     */
    downloadFfbinaries (libs = ['ffmpeg', 'ffprobe']) {
        return new Promise((resolve, reject) => {
            const arr = libs
            .map(i => this.getLibsStatus(i))
            .filter(i => i.download)
            .map(i => this.downloadAndSetEnv(i.downloadURL, i.libPath, i.type))
            Promise.allSettled(arr).then(results => {
                const isFailed = results.filter(item => item.status === 'rejected')
                if (isFailed.length > 0) {
                    reject(isFailed.map(i => i.error).join('/n'))
                } else {
                    resolve('download ffbinaries success')
                }
            })
        })
    }

    /**
     * Set the ffmpeg and ffprobe path
     * @param {String} ffmpegPath 
     * @param {String} ffprobePath 
     */
    setEnv (type, path) {
        if (type === 'ffmpeg') {
            ffmpeg.setFfmpegPath(path)
            console.log(colors.italic.black.bgGreen('[ffdown] ffmpeg: 环境变量设置成功'))
        }
        if (type === 'ffprobe') {
            ffmpeg.setFfprobePath(path)
            console.log(colors.italic.black.bgGreen('[ffdown] ffprobe: 环境变量设置成功'))
        }
    }

    async setProxy (proxyUrl) {
        const supported = ['linux', 'darwin']
        if (supported.indexOf(process.platform) === -1) {
            console.log(colors.italic.black.bgGreen('FFMPEG_PROXY_URL only supported on Linux or Macos'))
        } else {
            if (typeof (proxyUrl) === 'string' && proxyUrl) {
                const httpsProxyCmd = 'export https_proxy=http://' + proxyUrl
                const httpProxyCmd = 'export http_proxy=http://' + proxyUrl
                await execCmd(httpsProxyCmd)
                await execCmd(httpProxyCmd)
                console.log(colors.italic.blue('Set Proxy Success'))
            } else {
                await execCmd('unset http_proxy')
                await execCmd('unset https_proxy')
                console.log(colors.italic.blue('Unset Proxy Success'))
            }
        }
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

    setInputOption (ffmpegCmd) {
        // eslint-disable-next-line max-len
        const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36',
            REFERER_RGX = /^(?<referer>http|https:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+)(?::\d+)?\/[^ "]+$/u,
            match = this.M3U8_FILE.match(REFERER_RGX),
            [referer] = match === null ? ['unknown'] : match.slice(1)
        ffmpegCmd.inputOptions(
            [
                '-user_agent',
                `${USER_AGENT}`,
                '-referer',
                `${referer}/`,
            ],
        )
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

    monitorProcess (ffmpegCmd) {
        ffmpegCmd.ffprobe((err, data) => {
            if (err) {
                console.log(`Error: ${err.message}`)
                return
            }
            const duration = data.format.duration
            ffmpegCmd
            .on('progress', (progress) => {
                const percent = Math.round((progress.percent * 100) / 100)
                const processedDuration = duration * (progress.percent / 100)
                const remainingDuration = duration - processedDuration
                console.log(`Transcoding: ${percent}% done`)
                console.log(`Processed duration: ${processedDuration.toFixed(2)}s`)
                console.log(`Remaining duration: ${remainingDuration.toFixed(2)}s`)
            })
            .run()
        })
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
            const ffmpegCmd = ffmpeg(this.M3U8_FILE)
            ffmpegCmd.inputOptions(
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
            .on('end', () => {
                resolve()
            })
            if (this.THREADS) {
                ffmpegCmd.outputOptions(`-threads ${this.THREADS}`)
                ffmpegCmd.outputOptions('-preset ultrafast')
            }
            this.setOutputOption(ffmpegCmd)
            this.monitorProcess(ffmpegCmd)
            ffmpegCmd.run()
        })
    }
}

module.exports = m3u8ToMp4Converter
