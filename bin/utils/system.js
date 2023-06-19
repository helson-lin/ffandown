const childProcess = require('child_process')
const si = require('systeminformation')
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
    if (supported.indexOf(process.platform) === -1) { 
        return Promise.reject('the platform not support auto chmod, please do it by yourself') 
    } else {
        const cmd = `chmod +x ${file}`
        try {
            await execCmd(cmd)
            return Promise.resolve('chmod success')
        } catch (e) {
            return Promise.reject(e)
        }
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

module.exports = { getCpuNum, getNetwork, chmod, execCmd }