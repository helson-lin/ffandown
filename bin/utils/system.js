const childProcess = require('child_process')
const logger = require('./log')
const colors = require('colors')
const si = require('systeminformation')
const fs = require('fs')
const path = require('path')
const os = require('os')
/**
 * @description exec command
 * @date 3/16/2023 - 11:52:03 AM
 * @param {string} cmd
 * @returns {*}
 */
const execCmd = (cmd) => {
    return new Promise((resolve, reject) => {
        childProcess.exec(
            cmd,
            (error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            },
        )
    })
}

/**
 * @description File authorization
 * @date 3/16/2023 - 11:52:33 AM
 * @param {string} file
 */
const chmod = async (file) => {
    const supported = ['linux', 'darwin']
    // eslint-disable-next-line max-len, prefer-promise-reject-errors
    if (supported.indexOf(process.platform) === -1) { return Promise.reject('the platform not support auto chmod, please do it by yourself') }
    const cmd = `chmod +x ${file}`
    try {
        await execCmd(cmd)
        return Promise.resolve('chmod success')
    } catch (e) {
        return Promise.reject(e)
    }
}

/**
 * @description get all network interface ip
 * @returns {Array} list
 */
const getNetwork = () => {
    return new Promise((resolve, reject) => {
        si.networkInterfaces().then(data => {
            const list = data.filter(i => i.ip4).map(i => i.ip4)
            resolve(list || [])
        }).catch(error => {
            reject(error)
        })
    })
}

/**
 * @description 获取cpu核心数
 * @returns {number} cpu 核心数
 */
const getCpuNum = () => os.cpus().length

/**
 * @description 获取媒体目录下的所有的目录
 * @param {string} dirPath 
 * @param {string} basePath 
 * @returns 
 */
const getDirectories = async (dirPath, basePath) => {
    let directories = []
    const items = await fs.readdirSync(dirPath, { withFileTypes: true })
    for (const item of items) {
        if (item.isDirectory()) {
            const fullPath = path.join(dirPath, item.name)
            const relativePath = `${basePath}/${item.name}`.replaceAll('//', '/')
            const children = await getDirectories(fullPath, relativePath)
            directories.push({
                label: relativePath,
                value: relativePath,
            })
            directories = directories.concat(children)
        }
    }
    return directories
}

/**
 * @description 获取真实的url
 * @param {string} str 
 * @returns {string| string[]}
 */
const getRealUrl = (str) => {
    let urlArray = []
    // 支持换行符分割
    if (str.indexOf('\n') !== -1) {
        urlArray = str?.split('\n') ?? []
    }
    if (urlArray.length === 0) return str
    if (urlArray.length === 1) return urlArray[0]
    return urlArray
}

/**
 * @description set termial proxy
 * @param {string} proxyUrl 
 */
const setProxy = async (proxyUrl) => {
    try {
        // 存储当前代理设置到 process.env，这样子进程会继承这些环境变量
        if (!proxyUrl) {
            // 取消代理
            process.env.http_proxy = ''
            process.env.https_proxy = ''
            process.env.HTTP_PROXY = ''
            process.env.HTTPS_PROXY = ''
            
            // 同时在当前终端会话中取消代理(仅为了保持行为一致)
            if (process.platform === 'win32') {
                await execCmd('set http_proxy=')
                await execCmd('set https_proxy=')
            } else {
                await execCmd('unset http_proxy')
                await execCmd('unset https_proxy')
            }
            console.log(colors.blue('- Proxy cancelled'))
            return
        }
        
        // 设置代理到 process.env
        process.env.http_proxy = proxyUrl
        process.env.https_proxy = proxyUrl
        process.env.HTTP_PROXY = proxyUrl
        process.env.HTTPS_PROXY = proxyUrl
        
        // 同时在当前终端会话中设置代理(仅为了保持行为一致)
        if (process.platform === 'win32') {
            await execCmd(`set http_proxy=${proxyUrl}`)
            await execCmd(`set https_proxy=${proxyUrl}`)
        } else {
            await execCmd(`export http_proxy=${proxyUrl}`)
            await execCmd(`export https_proxy=${proxyUrl}`)
        }
        console.log(colors.blue('- Proxy has been set up'))
    } catch (error) {
        logger.error(error)
    }
}


module.exports = { getCpuNum, getNetwork, chmod, execCmd, getDirectories, getRealUrl, setProxy }