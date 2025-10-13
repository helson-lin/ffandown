const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const YAML = require('yamljs')
const json2yaml = require('js-yaml')
const { DEFAULT_OPTIONS, OUTPUTFORMAT_OPTIONS, PRESET_OPTIONS } = require('./constant')
// 生成随机字符串
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
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
    const config = { ...option, secret: generateRandomString(32) }
    
    const configPath = getConfigPath()
    if (!configPath) {
        console.log('[ffandown] not found config file, auto create config.yml')
        createYml({ ...config, downloadDir: '/media/' })
        return config
    }

    try {
        const data = YAML.parse(fs.readFileSync(configPath, 'utf8'))
        
        // 定义配置字段映射，简化赋值逻辑
        const configFields = {
            port: (value) => value,
            downloadDir: (value) => value,
            webhooks: (value) => value,
            webhookType: (value) => value,
            maxDownloadNum: (value) => value,
            autoInstallFFmpeg: (value) => value,
            enableTimeSuffix: (value) => value,
            preset: (value) => PRESET_OPTIONS.includes(value) ? value : config.preset,
            outputformat: (value) => OUTPUTFORMAT_OPTIONS.includes(value) ? value : config.outputformat,
            secret: (value) => value,
            proxy: (value) => value,
            cookieMaxAge: (value) => Number(value),
        }

        // 批量处理配置字段
        Object.entries(configFields).forEach(([key, validator]) => {
            if (data[key] !== undefined && data[key] !== null) {
                config[key] = validator(data[key])
            }
        })
        // 特殊处理：如果没有secret，自动生成一个
        if (!config.secret) config.secret = generateRandomString(32)
        // 特殊处理：debug模式
        if (data.debug) {
            process.env.DEBUG = true
        }

        return config
    } catch (error) {
        console.error('[ffandown] Error reading config file:', error.message)
        console.log('[ffandown] Using default configuration')
        return config
    }
}

module.exports = { readConfig, modifyYml, EnsureDonwloadPath }