const colors = require('colors')
const path = require('path')
const DOWNLOADZIP = require('download')
const fse = require('fs-extra')
const { chmod, execCmd } = require('./system')

// this is a temporary file used to store downloaded files, https://nn.oimi.space/ is a cfworker
// const GITHUBURL = 'https://nn.oimi.space/https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1'
const GITHUBURL = 'https://pic.kblue.site'

/**
 * @description: judege input path is a directory
 * @param {string} pathDir path 
 * @return {boolean} true: path is a file
 */
const isFile = (pathDir) => fse.pathExistsSync(pathDir)

/**
 * @description auto donwload ffmpeg file
 * @date 3/16/2023 - 11:53:57 AM
 * @async
 * @param {string} type
 * @returns {Promise<string>}
 */
const downloadFfmpeg = async (type) => {
    const typeLink = {
        win32: 'ffmpeg-4.4.1-win-64',
        darwin: 'ffmpeg-4.4.1-osx-64',
        'linux-x64': 'ffmpeg-4.4.1-linux-64',
        'linux-arm64': 'ffmpeg-4.4.1-linux-arm-64',
        'linux-amd64': 'ffmpeg-4.4.1-linux-armel-32',
    }
    const suffix = typeLink[type]
    const executableFileSuffix = typeLink[type].startsWith('win') ? 'ffmpeg.exe' : 'ffmpeg'
    const libPath = path.join(process.cwd(), `lib/${executableFileSuffix}`)
    const isExist = isFile(libPath)
    if (isExist) {
        return Promise.resolve(libPath)
    }
    // judge file is exists
    if (!suffix) {
        return Promise.reject(new Error('can\'t download ffmpeg'))
    }
    try {
        console.log(colors.italic.bgGreen.black('[ffdown]  downloading ffmpeg:' + `${GITHUBURL}/${suffix}.zip`))
        await DOWNLOADZIP(`${GITHUBURL}/${suffix}.zip`, 'lib', { extract: true })
        chmod(libPath)
        return Promise.resolve(libPath)
    } catch (e) {
        return Promise.reject(e)
    }
}

/**
 * @description: setting ffmpeg environment variables
 * @return {void}
 */
const setFfmpegEnv = async () => {
    const platform = process.platform
    const arch = process.arch
    const type = platform + (platform === 'linux' ? `-${arch}` : '')
    let baseURL = ''
    try {
        baseURL = await downloadFfmpeg(type)
        process.env.FFMPEG_PATH = baseURL
        console.log(colors.italic.black.bgGreen('[ffdown] Setting FFMPEG_PATH: ' + baseURL))
        if (process.env.FFMPEG_PATH !== baseURL) {
            console.log(colors.italic.black.bgGreen('[ffdown] ffmpeg: 环境变量设置成功'))
        }
        return Promise.resolve()
    } catch (e) {
        console.log(colors.italic.red('download ffmpeg failed: ' + String(e).trim()))
        return Promise.reject('download ffmpeg failed: ' + String(e).trim())
    }
}
/**
 * @description set termial proxy
 * @param {string} proxyUrl 
 */
const setProxy = async (proxyUrl) => {
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

module.exports = { setFfmpegEnv, setProxy }