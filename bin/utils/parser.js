const path = require('path')
const fetch = require('node-fetch')
const vm = require('vm')
const fs = require('fs')
const fse = require('fs-extra')
const log = require('./log')
const bcrypt = require('bcrypt')
const pluginService = require('../sql/pluginService')

/**
 * @description 创建一个受限的文件系统接口
 * @param {string} allowedDir 允许访问的目录
 * @returns {Object} 包含受限文件操作方法的对象
 */
function createSandboxedFs(allowedDir) {
    // 确保目录存在
    if (!fs.existsSync(allowedDir)) {
        fs.mkdirSync(allowedDir, { recursive: true })
    }
    
    // 验证路径是否在允许的目录内
    const isPathAllowed = (filePath) => {
        const resolvedPath = path.resolve(filePath)
        return resolvedPath.startsWith(allowedDir)
    }
    
    // 创建受限的文件系统操作对象
    return {
        readFileSync: (filePath, options) => {
            if (!isPathAllowed(filePath)) {
                throw new Error('Access denied: Cannot read files outside the permitted directory')
            }
            return fs.readFileSync(filePath, options)
        },
        
        writeFileSync: (filePath, data, options) => {
            if (!isPathAllowed(filePath)) {
                throw new Error('Access denied: Cannot write files outside the permitted directory')
            }
            return fs.writeFileSync(filePath, data, options)
        },
        
        existsSync: (filePath) => {
            if (!isPathAllowed(filePath)) {
                throw new Error('Access denied: Cannot check files outside the permitted directory')
            }
            return fs.existsSync(filePath)
        },
        
        mkdirSync: (dirPath, options) => {
            if (!isPathAllowed(dirPath)) {
                throw new Error('Access denied: Cannot create directories outside the permitted directory')
            }
            return fs.mkdirSync(dirPath, options)
        },
        
        readdirSync: (dirPath, options) => {
            if (!isPathAllowed(dirPath)) {
                throw new Error('Access denied: Cannot read directories outside the permitted directory')
            }
            return fs.readdirSync(dirPath, options)
        },
        
        // 可以根据需要添加更多方法，如 unlinkSync, statSync 等
        unlinkSync: (filePath) => {
            if (!isPathAllowed(filePath)) {
                throw new Error('Access denied: Cannot delete files outside the permitted directory')
            }
            return fs.unlinkSync(filePath)
        },
        
        statSync: (filePath) => {
            if (!isPathAllowed(filePath)) {
                throw new Error('Access denied: Cannot stat files outside the permitted directory')
            }
            return fs.statSync(filePath)
        },
    }
}

// ... rest of the file ...
/**
 * @description 从文本中提取注解
 * @param {*} text 
 * @returns 
 */
const extractScriptBlock = (text) => {
    let textRemoveComments = text
    const allAnnotations = text.match(/\/\/.+\n/g)
    if (allAnnotations && allAnnotations.length) {
        let code = 0
        const pluginInfo =  allAnnotations.reduce((pre, value) => {
            const splitSpaceAndLine = (str) => str.replace(/^\/\/\s*/gm, '').trim()
            if (splitSpaceAndLine(value) === '==FFandownScript==') {
                code = 1
                textRemoveComments = textRemoveComments.replace(value, '')
                return pre
            } else if (splitSpaceAndLine(value) === '==/FFandownScript==') {
                code = 0
                textRemoveComments = textRemoveComments.replace(value, '')
                return pre
            } else if (code === 1 && value)  {
                const info = splitSpaceAndLine(value)
                const match = info.match(/^@(\w+)\s+(.+)$/)
                if (!match) return pre
                let key = match[1]
                let val = match[2]
                key = key && key.trim()
                val = val && val.trim()
                if (key && val) pre[key] = val
                textRemoveComments = textRemoveComments.replace(value, '')
            } 
            return pre
        }, {})
        return {
            pluginInfo,
            textRemoveComments,
        }
    } else {
        return { pluginInfo: null, textRemoveComments }
    }
}

/**
 * @description 解析插件代码并创建解析器实例
 * @param {string} jsCode 包含解析器类定义的 JavaScript 代码
 * @returns {Object} 返回解析器实例
 * @throws {Error} 当代码格式错误或执行失败时抛出异常
 */
const makeParser = (jsCode) => {
    if (typeof jsCode !== 'string' || !jsCode.trim()) {
        throw new Error('Invalid parser code')
    }
    const sandbox = {
        fetch,
        log,
        bcrypt,
        console,
        URL,
        URLSearchParams,
        CWD_PATH: process.cwd(),
        // 提供受限的文件系统操作
        fs: createSandboxedFs(path.join(process.cwd(), './tmp')),
        path: {
            join: (...args) => {
                // 只允许在指定目录内操作
                const basePath = path.join(process.cwd(), './tmp')
                const requestedPath = path.join(...args)
                // 确保路径不会超出基础目录
                if (!path.resolve(requestedPath).startsWith(basePath)) {
                    throw new Error('Access denied: Cannot access paths outside the permitted directory')
                }
                return requestedPath
            },
        },
    }
    try {
        // 将沙箱对象包装到 VM 中
        const script = new vm.Script(`(() => ${jsCode})()`)
        // 创建一个新的上下文
        const context = vm.createContext(sandbox)
        // 在沙箱中运行脚本
        const Parser = script.runInContext(context)
        // console.log(jsCode,Parser)
        if (typeof Parser !== 'function') {
            throw new Error('Parser must be a constructor function')
        }
        const parser = new Parser()
        return parser
    } catch (error) {
        throw new Error(`Failed to create parser: ${error.message}`)
    }
}

/**
 * @description 获取所有解析器
 * @returns {Array} 返回所有可用的解析器数组
 */
const getAllParsers = async () => {
    // 获取解析器插件目录路径
    const parsersPluginDir = path.join(process.cwd(), './parsers')
    // 检查插件目录是否存在
    const isDir = fs.existsSync(parsersPluginDir)
    // 如果目录不存在则创建
    if (!isDir) fs.mkdirSync(parsersPluginDir)
    // 读取目录下所有文件
    const allFiles = fs.readdirSync(parsersPluginDir)
    // 所有的插件
    const allParsers = []
    // 过滤出所有js文件并获取完整路径
    const jsFiles = allFiles.map(i => path.join(parsersPluginDir, i)).filter(file => file.endsWith('.js'))
    // 从数据库内拿到所有的启用插件
    const allPlugins = await pluginService.getAll()
    // 遍历所有js文件
    jsFiles.forEach(jsFile => {
        // 读取js文件内容
        const plugin = allPlugins.find(plugin => plugin.localUrl === jsFile)
        const jsFileContent = fs.readFileSync(jsFile, 'utf8')
        try {
            // 构建解析器实例
            const parser = makeParser(jsFileContent)
            // 将解析器添加到数组中
            allParsers.push({ func: parser, options: plugin?.options || '{}' })
        } catch (e) {
            // 解析器构建失败时输出错误信息
            console.error('解析器构建失败', e)
        }
    })
    return allParsers
}

/**
 * @description 自动解析URL，根据匹配的解析器进行处理
 * @param {string} url 需要解析的URL
 * @returns {Promise<string>} 解析后的结果，如果没有匹配的解析器或解析失败则返回原始URL
 */
const autoParser = async (url) => {
    try {
        // 获取所有可用的解析器
        const parsers = await getAllParsers()
        // 查找第一个能匹配当前URL的解析器
        const parserMatched = parsers.find(item => item.func?.match(url))
        if (parserMatched) {
            log.verbose('Matched Plugin: '  + url)
            let options
            try {
                options = JSON.parse(parserMatched?.options)
            } catch {
                options = {}
            }
            // 使用匹配的解析器处理URL
            const parsedData =  await parserMatched.func?.parser(url, options)
            log.verbose('Parsed Data:' + JSON.stringify(parsedData))
            if (!parsedData) return { url }
            else return parsedData
        } else {
            log.verbose('No Matched Plugin: ' + url)
            // 如果没有匹配的解析器，返回原始URL
            return { url }
        }
    } catch (e) {
        log.error('Parse error: ' + String(e))
        // 解析过程出现错误时，返回原始URL
        return { url }
    }
}

const savePlugin = (pluginInfo, pluginContent, localUrl) => {
    const randomStr = () => Math.random().toString(36).slice(2)
    const name = pluginInfo.name ? pluginInfo.name + '_' + randomStr() : randomStr()
    const parsersDir = path.join(process.cwd(), './parsers')
    // 确保 parsers 文件夹存在
    fse.ensureDirSync(parsersDir)
    // 生成插件文件名
    const pluginPath = localUrl ?? path.join(parsersDir, `/${name}.js`)
    fs.writeFileSync(pluginPath, pluginContent, 'utf8')
    pluginInfo.localUrl = pluginPath
    // 存储到数据库内
    return pluginInfo
}

/**
 * @description 获取插件内容
 * @param {String} url 
 * @param {Boolean} tls 
 * @returns 
 */
const getPlugin = (url, localUrl) => {
    return new Promise( (resolve, reject) => {
        try {
            // 1. 下载插件内容
            fetch(url).then((res) => res.text()).then(async (pluginContent) => {
                const required = ['name', 'author', 'description', 'version']
                // 缺少注解信息
                const lossKey = []
                const { pluginInfo,  textRemoveComments } = await extractScriptBlock(pluginContent)
                // 2. 解析插件信息
                console.log(pluginInfo, textRemoveComments)
                required.forEach(requiredKey => {
                    if (pluginInfo[requiredKey] === undefined) lossKey.push(requiredKey)
                })
                if (lossKey.length > 0) {
                    reject(`Lack of annotation information: ${lossKey.join(', ')}`)
                } else {
                    pluginInfo.url = url
                    log.verbose('Check Plugin is available')
                    // 1. 查看插件是否可以使用
                    const parserPlugin = makeParser(textRemoveComments)
                    if (!parserPlugin.match || !parserPlugin.parser) {
                        log.verbose('Plugin cannot be used, missing match or parser methods')
                        reject('Plugin cannot be used, missing match or parser methods')
                    } else {
                        // 2. 保存插件到本地目录
                        log.verbose('Save Plugin to local directory')
                        savePlugin(pluginInfo, textRemoveComments, localUrl)
                        resolve(pluginInfo)
                    }
                }
            }).catch(e => {
                log.error(e)
                reject(e)
            })
            // 2. 解析插件
        } catch (e) {
            reject(e)
        }
    })
}

module.exports = { autoParser, getPlugin }
