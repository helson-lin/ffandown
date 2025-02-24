const path = require('path')
const fs = require('fs')

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
    try {
        const Parser = new Function(`return ${jsCode}`)()
        if (typeof Parser !== 'function') {
            throw new Error('Parser must be a constructor function')
        }
        Parser.prototype.fetch = fetch
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
            console.error('解析器构建失败', jsFile)
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

module.exports = autoParser