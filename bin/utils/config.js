const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const YAML = require('yamljs')
const json2yaml = require('js-yaml')
const logger = require('../log')
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
    port: 8081,
    downloadDir: path.join(process.cwd(), 'media'), 
    webhooks: '',
    webhookType: 'bark',
    thread: false,
    downloadThread: true,
    useFFmpegLib: true }) => {
    const configPath = getConfigPath()
    if (!configPath) {
        logger.info('not found config file, auto create config.yml')
        // make sure download dir is exists
        EnsureDonwloadPath('/media/')
        createYml({ ...option, downloadDir: '/media/' })
    } else {
        const data = YAML.parse(fs.readFileSync(configPath).toString())
        const { port, downloadDir, webhooks, webhookType, thread, useFFmpegLib, downloadThread } = data
        if (port) option.port = port
        if (downloadDir) option.downloadDir = EnsureDonwloadPath(downloadDir)
        if (webhooks) option.webhooks = webhooks
        if (webhookType) option.webhookType = webhookType
        if (thread !== undefined) option.thread = thread
        if (downloadThread !== undefined) option.downloadThread = downloadThread
        if (useFFmpegLib !== undefined) option.useFFmpegLib = useFFmpegLib
    }
    return option
}

module.exports = { readConfig }