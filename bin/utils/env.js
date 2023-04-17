const logger = require('../log')
const colors = require('colors')
const path = require('path')
const DOWNLOADZIP = require('download')
const fse = require('fs-extra')
const { chmod } = require('./core')

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
        console.log(colors.italic.red('[ffdown] can\'t auto download ffmpeg \n'))
        return Promise.reject(new Error('can\'t download ffmpeg'))
    }
    try {
        console.log(colors.italic.green('[ffdown]  downloading ffmpeg:' + `${GITHUBURL}/${suffix}.zip`))
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
        logger.info('Setting FFMPEG_PATH:' + baseURL)
        if (process.env.FFMPEG_PATH !== baseURL) {
            console.log(colors.italic.cyan('[ffdown] ffmpeg: 环境变量设置成功'))
        }
    } catch (e) {
        console.log('download Failed', e)
    }
}

module.exports = { setFfmpegEnv }