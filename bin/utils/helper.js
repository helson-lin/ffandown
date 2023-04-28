const os = require('os')
const colors = require('colors')
const path = require('path')
const download = require('download')
const fse = require('fs-extra')
const ffmpeg = require('fluent-ffmpeg')
const { chmod, execCmd } = require('./system')

// this is a temporary file used to store downloaded files, https://nn.oimi.space/ is a cfworker
// 'https://nn.oimi.space/https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1'

const helper = {
    registoryUrl: 'https://pic.kblue.site',
    setRegistoryUrl (url) {
        this.registoryUrl = url
    },
    /**
    * @description: set type
    * @param {boolean} ffmpeg is need download 
    * @return {boolean} ffprobe is need download
    */
    setTypes (ffmpeg = false, ffprobe = false) {
        this.ffmpeg = ffmpeg
        this.ffprobe = ffprobe
        return this
    },
    /**
    * @description: judege input path is a directory
    * @param {string} pathDir path 
    * @return {boolean} true: path is a file
    */
    isExist (pathDir) { return fse.pathExistsSync(pathDir) },
    /**
     * @description: get lib path
     * @param {string} componentName path 
     * @return {string} lib path
     */
    getLibPath (componentName = 'ffmpeg') {
        const executableFileSuffix = os.platform().startsWith('win') ? `${componentName}.exe` : componentName
        return path.join(process.cwd(), `lib/${executableFileSuffix}`)
    },
    /**
     * @description 
     * @param {string} url download url
     * @param {string} libPath lib path
     * @param {string} type 类型 ffmpeg/ffprobe
     * @return {void}
     */
    async downloadAndSetEnv (url, libPath, type) {
        try {
            await download(url, 'lib', { extract: true })
            this.setEnv(type, libPath)
            await chmod(libPath)
        } catch (e) {
            console.warn('download and set env failed:' + String(e).trim())
        }
    },
    /**
     * @description get current device platform
     * @returns {string|null} platform
     */
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
    },
    /**
     * get binaries download urls
     * @param {String} component ffmpeg ffprobe
     * @returns {String} download url
    */
    getDownloadUrl (component, version = '4.4.1') {
        return `${this.registoryUrl}/${component}-${version}-${this.detectPlatform()}.zip`
    },
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
    },

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
    },
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
    },

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
    },

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
    },
}

module.exports = helper