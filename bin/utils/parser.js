const path = require('path')
const fetch = require('node-fetch')
const vm = require('vm')
const fs = require('fs')
const log = require('./log')

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
                textRemoveComments = textRemoveComments.replace(value, '')
                const info = splitSpaceAndLine(value)
                const match = info.match(/^@(\w+)\s+(.+)$/)
                if (!match) return pre
                let key = match[1]
                let val = match[2]
                key = key && key.trim()
                val = val && val.trim()
                if (key && val) pre[key] = val
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
        fetch: fetch,
        log,
        console,
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
const getAllParsers = () => {
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
    // 遍历所有js文件
    jsFiles.forEach(jsFile => {
        // 读取js文件内容
        const jsFileContent = fs.readFileSync(jsFile, 'utf8')
        try {
            // 构建解析器实例
            const parser = makeParser(jsFileContent)
            // 将解析器添加到数组中
            allParsers.push(parser)
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
        const parsers = getAllParsers()
        // 查找第一个能匹配当前URL的解析器
        const parserMatched = parsers.find(item => item.match(url))
        if (parserMatched) {
            // 使用匹配的解析器处理URL
            return await parserMatched.parser(url)
        } else {
            // 如果没有匹配的解析器，返回原始URL
            return url
        }
    } catch {
        // 解析过程出现错误时，返回原始URL
        return url
    }
}

const savePlugin = (pluginInfo, pluginContent) => {
    const randomStr = () => Math.random().toString(36).slice(2)
    const name = pluginInfo.name ? pluginInfo.name + '_' + randomStr() : randomStr()
    const pluginPath = path.join(process.cwd(), `./parsers/${name}.js`)
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
const getPlugin = (url, tls = true) => {
    return new Promise( (resolve, reject) => {
        try {
            // 1. 下载插件内容
            fetch(url).then((res) => res.text()).then(async (pluginContent) => {
                const required = ['name', 'author', 'description', 'version']
                // 缺少注解信息
                const lossKey = []
                const { pluginInfo,  textRemoveComments } = await extractScriptBlock(pluginContent)
                // 2. 解析插件信息
                required.forEach(requiredKey => {
                    if (pluginInfo[requiredKey] === undefined) lossKey.push(requiredKey)
                })
                if (lossKey.length > 0) {
                    reject(`Lack of annotation information: ${lossKey.join(', ')}`)
                } else {
                    pluginInfo.url = url
                    // 1. 查看插件是否可以使用
                    const parserPlugin = makeParser(textRemoveComments)
                    if (!parserPlugin.match || !parserPlugin.parser) {
                        reject('Plugin cannot be used, missing match or parser methods')
                    } else {
                        // 2. 保存插件到本地目录
                        console.log(pluginInfo)
                        log.verbose('plugininfo: ', JSON.stringify(pluginInfo))
                        savePlugin(pluginInfo, textRemoveComments)
                        resolve(pluginInfo)
                    }
                }
            }).catch(e => {
                reject(e)
            })
            // 2. 解析插件
        } catch (e) {
            reject(e)
        }
    })
}

module.exports = { autoParser, getPlugin }