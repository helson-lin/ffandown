const childProcess = require('child_process')
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

const isBase64 = (str) => {
    try {
        // 尝试将字符串解码为Buffer
        const buffer = Buffer.from(str, 'base64')
        // 如果解码成功，检查解码后的Buffer是否与原始字符串相同
        return buffer.toString('base64') === str
    } catch (err) {
        // 如果解码失败，返回false
        return false
    }
}

const getRealUrl = (str) => {
    let urlArray = []
    if (str.indexOf('\n') !== -1) {
        urlArray = str?.split('\n') ?? []
    }
    if (str.indexOf(',') !== -1) {
        urlArray = str?.split(',') ?? []
    }
    if (urlArray.length === 0) return str
    if (urlArray.length === 1) return urlArray[0]
    return urlArray
}

module.exports = { getCpuNum, getNetwork, chmod, execCmd, getDirectories, getRealUrl }