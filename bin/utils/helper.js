const childProcess = require('child_process')
const fse = require('fs-extra')
const path = require('path')
const os = require('os')
const ffmpeg = require('fluent-ffmpeg')
const download = require('download')
const colors = require('colors')

const Helper = {
    version: '6.1',
    registryUrl: 'https://storage.helson-lin.cn',
    registryMap: {
        github: 'https://nn.oimi.space/https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1',
        selfCdn: 'https://storage.helson-lin.cn',
    },
    dependencyList: ['ffmpeg', 'ffprobe'],
    /**
     * @description change ffmpeg dependency download registry
     * @param {string} nameOrBaseUrl
     */
    changeRegistry (nameOrBaseUrl) {
        if (!nameOrBaseUrl) throw new Error('nameOrBaseUrl cant be none')
        const isInnerRegistry = Object.keys(this.registryMap).includes(nameOrBaseUrl)
        if (isInnerRegistry) {
            this.registryUrl = this.registryMap[nameOrBaseUrl]
        } else {
            this.registryUrl = nameOrBaseUrl
        }
    },
    /**
    * @description: judge input path is a directory
    * @param {string} pathDir path
    * @return {boolean} true: path is a file
    */
    isExist (pathDir) { return fse.pathExistsSync(pathDir) },
    /**
     * @description exec command
     * @param {string} cmd
     * @returns {*}
     */
    execCmd (cmd) {
        return new Promise((resolve, reject) => {
            childProcess.exec(
                cmd,
                (error) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve()
                    }
                },
            )
        })
    },
    async chmod (file) {
        const supported = ['linux', 'darwin']
        return new Promise((resolve, reject) => {
            if (supported.indexOf(process.platform) === -1) {
                reject(new Error('the platform not support auto chmod, please do it by yourself'))
            } else {
                const cmd = `chmod +x ${file}`
                this.execCmd(cmd).then(() => {
                    resolve('chmod success')
                }).catch((e) => reject(e))
            }
        })
    },
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
     * @description get current device platform
     * @returns {string|null} platform
     */
    detectPlatform () {
        let type = (os.type()).toLowerCase()
        let arch = (os.arch()).toLowerCase()
        // macos 系统
        if (type === 'darwin') return 'osx-64'
        // windows 系统 将不支持 windows-32
        if (type === 'windows_nt') return arch === 'x64' ? 'windows-64' : null
        // linux 系统
        if (type === 'linux') {
            if (arch === 'arm' || arch === 'arm64') return 'linux-arm-64'
            return arch === 'x64' ? 'linux-64' : 'linux-32'
        }
        return null
    },
    /**
     * @description get binaries download urls ｜ 获取依赖下载地址
     * @param {String} component ffmpeg ffprobe
     * @returns {String} download url
    */
    getDownloadUrl (component, version = '4.4.1') {
        const platform = this.detectPlatform()
        // 如果没有平台信息，那么直接 return null
        if (!platform) return null
        return `${this.registryUrl}/${component}-${version}-${this.detectPlatform()}.zip`
    },
    /**
     * @description 设置环境变量
     * @param {String} type 
     * @param {String} path 
     */
    setEnv (type, path) {
        if (type === 'ffmpeg') {
            ffmpeg.setFfmpegPath(path)
        }
        if (type === 'ffprobe') {
            ffmpeg.setFfprobePath(path)
        }
        console.log(`\x1b[32m[ffandown] ${type}: env variable is set successfully\x1b[0m`)
    },
    /**
     * @description is need download 是否需要下载依赖
     * @param {String} type ffmpeg ffprobe
     * @returns {boolean} true: need to download ffmpeg
    */
    needDownload (type) {
        const libPath = this.getLibPath(type)
        const isExist = this.isExist(libPath)
        if (isExist) {
            this.setEnv(type, libPath)
            return false
        }
        return true
    },
    /**
    * @description 获取依赖信息
    * @param {ffmpeg|ffprobe} type
    * @returns
    */
    getLibsStatus (type) {
        return {
            type,
            libPath: this.getLibPath(type),
            downloadURL: this.getDownloadUrl(type, this.version),
            download: this.needDownload(type),
        }
    },
    /**
     * @description 下载依赖并设置环境变量
     * @param {string} url download url
     * @param {string} libPath lib path
     * @param {string} type 类型 ffmpeg/ffprobe
     * @return {void}
     */
    async downloadAndSetEnv (url, libPath, type) {
        try {
            console.log(colors.blue(`[ffandown] Downloading ${type} dependencies...`))
            if (!url) {
                // 提示手动下载依赖
                console.log(colors.red(`You need to manually download ${type} dependencies for you device. 
                    Website: https://ffbinaries.com/downloads`))
                return
            }
            // download ffmpeg or ffprobe dependency
            await download(url, 'lib', { extract: true })
            this.setEnv(type, libPath)
            await this.chmod(libPath)
        } catch (e) {
            console.warn('download and set env failed:' + String(e).trim())
        }
    },
    /**
     * @description download ffbinary 下载依赖
     * @param {Array} libs
     * @returns
    */
    downloadDependency (libs = this.dependencyList) {
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
                    resolve('download binaries success')
                }
            })
        })
    },
    /**
     * @description: make sure directory exists
     * @param {string} _path configuration path
     * @return {string} real download directory
     */
    ensurePath  (_path) {
        if (_path.startsWith('@')) {
            const relPath = _path.replace('@', '')
            fse.ensureDirSync(relPath)
            return relPath
        }
        const relPath = path.join(process.cwd(), _path)
        fse.ensureDirSync(relPath)
        return relPath
    },
    ensureMediaDir: (_path) => fse.ensureDirSync(_path),
    getUrlFileExt (url) {
        const parsedUrl = new URL(`http://${url}`)
        return parsedUrl.pathname.split('.').pop()
    },
}

module.exports = Helper
