const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const YAML = require('yamljs')
const json2yaml = require('js-yaml')

// 生成随机字符串
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
} 

const DEFAULT_OPTIONS = {
    port: 8081,
    downloadDir: '/media/', 
    webhooks: '',
    webhookType: 'bark',
    thread: false,
    useFFmpegLib: true,
    maxDownloadNum: 5,
    preset: 'medium',
    outputformat: 'mp4',
    enableTimeSuffix: false,
    secret: generateRandomString(32),
}
// 支持的视频格式
const OUTPUTFORMAT_OPTIONS = ['mp4', 'mov', 'flv', 'avi', 'mkv', 'ts']
// 支持的ffmpeg preset
const PRESET_OPTIONS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow']
/**
 * @description: find config.yaml location
 * @return {string}
 */
const getConfigPath = () => {
    const configPathList = [
        path.join(process.cwd(), './config/config.yml'), 
        path.join(process.cwd(), '../config/config.yml')]
    return configPathList.find(_path => fse.pathExistsSync(_path))
}

/**
 * @description create yml option file
 * @date 3/14/2023 - 6:01:54 PM
 * @param {object} obj
 */
const createYml = (obj) => {
    const yamlString = json2yaml.dump(obj, { lineWidth: -1 })
    const filePath = path.join(process.cwd(), './config/config.yml')
    fse.outputFileSync(filePath, yamlString)
}

const modifyYml = (obj) => {
    const yamlString = json2yaml.dump(obj, { lineWidth: -1 })
    const filePath = path.join(process.cwd(), './config/config.yml')
    fse.writeFileSync(filePath, yamlString)
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
const readConfig = (option = DEFAULT_OPTIONS) => {
    const configPath = getConfigPath()
    if (!configPath) {
        console.log('[ffandown] not found config file, auto create config.yml')
        createYml({ ...option, downloadDir: '/media/' })
    } else {
        const data = YAML.parse(fs.readFileSync(configPath).toString())
        const { 
            port, downloadDir, maxDownloadNum, webhooks, enableTimeSuffix,
            webhookType, preset, outputformat, useFFmpegLib, debug, secret,
        } = data
        if (port) option.port = port
        if (downloadDir) option.downloadDir = downloadDir
        if (webhooks) option.webhooks = webhooks
        if (webhookType) option.webhookType = webhookType
        if (maxDownloadNum) option.maxDownloadNum = maxDownloadNum
        if (useFFmpegLib !== undefined) option.useFFmpegLib = useFFmpegLib
        // check preset and outputformat is legal
        if (preset && PRESET_OPTIONS.includes(preset)) option.preset = preset
        if (outputformat && OUTPUTFORMAT_OPTIONS.includes(outputformat)) option.outputformat = outputformat
        if (enableTimeSuffix) option.enableTimeSuffix = enableTimeSuffix
        if (secret) option.secret = secret
        // if secret is undefined, auto create a secret
        if (!secret) option.secret = generateRandomString(32)
        if (debug) process.env.DEBUG = true
        // 支持代理设置
        if (data.proxy) option.proxy = data.proxy
    }
    return option
}

module.exports = { readConfig, modifyYml, EnsureDonwloadPath }