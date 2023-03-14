
const path = require('path')
const YAML = require('yamljs')
const json2yaml = require('js-yaml')
const colors = require('colors')
const request = require('request')
const fs = require('fs')
const fse = require('fs-extra')
const childProcess = require('child_process')
const DOWNLOADZIP = require('download')
const m3u8ToMp4 = require('./m3u8')
const converter = new m3u8ToMp4()
const logger = require('./log')

// const GITHUBURL = 'https://nn.oimi.space/https://github.com/helson-lin/ffmpeg_binary/releases/download/4208999990'
const GITHUBURL = 'https://nn.oimi.space/https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1'
/**
 * @description: find config.yaml location
 * @return {string}
 */
const getConfigPath = () => {
    const configPathList = [path.join(process.cwd(), 'config.yml'), path.join(process.cwd(), '../config.yml')]
    return configPathList.find(_path => fse.pathExistsSync(_path))
}

/**
 * @description create yml option file
 * @date 3/14/2023 - 6:01:54 PM
 * @param {object} obj
 */
const createYml = (obj) => {
    const yamlString = json2yaml.dump(obj, { lineWidth: -1 })
    const filePath = path.join(process.cwd(), 'config.yml')
    fse.outputFileSync(filePath, yamlString)
}

/**
 * @description: make sure download directory exists
 * @param {string} _path configuration path
 * @return {string} real download directory
 */
const EnsureDonwloadPath = (_path) => {
    if (_path.startsWith('@')) {
        const relPath = _path.replace('@', '')
        fse.ensureDirSync(relPath)
        return relPath
    }
    const relPath = path.join(process.cwd(), _path)
    fse.ensureDirSync(relPath)
    return relPath
}

/**
 * @description: read configuration file and return configuration
 * @return {object} configuration object
 */
const readConfig = (option = { 
    port: 8080,
    downloadDir: path.join(process.cwd(), 'media'), 
    webhooks: '',
    webhookType: 'bark',
    thread: true,
    useFFmpegLib: true }) => {
    const configPath = getConfigPath()
    if (!configPath) {
        logger.info('not found config file, auto create config.yml')
        createYml({ ...option, downloadDir: '/media/' })
    } else {
        const data = YAML.parse(fs.readFileSync(configPath).toString())
        const { port, path, webhooks, webhookType, thread, useFFmpegLib } = data
        if (port) option.port = port
        if (path) option.downloadDir = EnsureDonwloadPath(path)
        if (webhooks) option.webhooks = webhooks
        if (webhookType) option.webhookType = webhookType
        if (thread !== undefined) option.thread = thread
        if (useFFmpegLib !== undefined) option.useFFmpegLib = useFFmpegLib
    }
    return option
}

/**
 * @description: generate feishu hooks request body
 * @param {string} text  title
 * @param {string} More   body 
 * @return {object} Request body
 */
const getFeiShuBody = (text, More) => {
    const content = []
    if (text) {
        content.push([{
            tag: 'text',
            text: `${text}`,
        }])
    }
    if (More) {
        content.push([{
            tag: 'text',
            text: `${More}`,
        }])
    }
    return {
        msg_type: 'post',
        content: {
            post: {
                zh_cn: {
                    title: '文件下载通知',
                    content,
                },
            },
        },
    }
}

const getBarkUrl = (url, text) => url.replace('$TEXT', `${encodeURIComponent(text)}`)

/**
 * @description: judege input path is a directory
 * @param {string} pathDir path 
 * @return {boolean} true: path is a file
 */
const isFile = (pathDir) => fse.pathExistsSync(pathDir)

/**
 * @description: send message notice to user
 * @param {string} url hooks url
 * @param {string} type hooks type
 * @param {string} Text title text
 * @param {string} More body text
 * @return {void}
 */
const msg = (url, type, Text, More) => {
    const URL = type === 'bark' ? getBarkUrl(url, Text) : url
    const method = type === 'bark' ? 'GET' : 'POST'
    const bodyHanler = { bark: () => ({}), feishu: getFeiShuBody }
    const data = bodyHanler[type](Text, More)
    request({
        url: URL,
        method,
        body: JSON.stringify(data),
    })
}

const execCmd = (cmd) => {
    return new Promise((resolve, reject) => {
        childProcess.exec(
            cmd,
            (error) => {
                if (error) {
                    logger.warn(error)
                    reject(error)
                } else {
                    resolve()
                }
            },
        )
    })
}

const chmod = (file) => {
    // if(process.platform !== 'linux') return
    // if(process.platform === 'darwin') return
    const cmd = `chmod +x ${file}`
    execCmd(cmd)
}

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
 * @description: download m3u8 video to local storage
 * @param {string} url m3u8 url
 * @param {string} name fielName
 * @param {string} filePath file output path
 * @param {string} webhooks webhooks url
 * @param {string} webhookType webhooks type
 * @return {Promise}
 */
const download = (url, name, filePath, { webhooks, webhookType }) => {
    return new Promise((resolve, reject) => {
        converter
        .setInputFile(url)
        .setOutputFile(filePath)
        .start()
        .then(res => {
            if (webhooks) {
                console.log('下载成功：' + name)
                msg(webhooks, webhookType, `${name}.mp4 下载成功`)
            }
            resolve()
        }).catch(err => {
            console.log('下载失败', webhooks)
            console.log('下载失败：' + err)
            if (webhooks) {
                console.log('we', webhooks, webhookType)
                msg(webhooks, webhookType, `${name}.mp4 下载失败！`, err + '')
            }
            reject(err)
        })
    })
}

/**
 * @description: find ffmpeg executable file path
 * @param {string} suffixPath
 * @return {string} ffmpeg path
 */
const FFMPEGPath = (suffixPath) => {
    const cwdPath = process.cwd() + suffixPath
    const cdPath = path.join(process.cwd(), '..' + suffixPath)
    try {
        return isFile(cwdPath) ? cwdPath : cdPath
    } catch (e) {
        console.log(e)
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
        logger.debug('Setting FFMPEG_PATH:' + baseURL)
        logger.warn('Setting FFMPEG_PATH:' + baseURL)
        // console.log("Setting FFMPEG_PATH:" + baseURL)
        if (process.env.FFMPEG_PATH !== baseURL) {
            console.log(colors.italic.cyan('[ffdown] ffmpeg: 环境变量设置成功'))
        }
    } catch (e) {
        console.log('download Failed', e)
    }
}

module.exports = {
    readConfig,
    download,
    msg,
    setFfmpegEnv,
    FFMPEGPath,
}