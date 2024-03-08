const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const YAML = require('yamljs')
const json2yaml = require('js-yaml')

const DEFAULT_OPTIONS = {
    port: 8081,
    downloadDir: '/media/', 
    webhooks: '',
    webhookType: 'bark',
    thread: true,
    useFFmpegLib: true,
    maxDownloadNum: 5,
}
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
        console.log('not found config file, auto create config.yml')
        createYml({ ...option, downloadDir: '/media/' })
    } else {
        const data = YAML.parse(fs.readFileSync(configPath).toString())
        const { port, downloadDir, maxDownloadNum, webhooks, webhookType, useFFmpegLib, debug } = data
        if (port) option.port = port
        if (downloadDir) option.downloadDir = downloadDir
        if (webhooks) option.webhooks = webhooks
        if (webhookType) option.webhookType = webhookType
        if (maxDownloadNum) option.maxDownloadNum = maxDownloadNum
        if (useFFmpegLib !== undefined) option.useFFmpegLib = useFFmpegLib
        if (debug) process.env.DEBUG = true
    }
    return option
}

module.exports = { readConfig, modifyYml, EnsureDonwloadPath }