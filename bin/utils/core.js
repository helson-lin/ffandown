/** process operation、file download、cmd exec  */
const childProcess = require('child_process')
const si = require('systeminformation')
const logger = require('./log')

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
                    logger.warn(error)
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
const chmod = (file) => {
    if (process.platform === 'linux' || process.platform === 'darwin') {
        const cmd = `chmod +x ${file}`
        execCmd(cmd)
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
 * @description check input url is be supported
 * @param {string} url
 * @returns {boolean}
 */
const isSupportedUrl = (url) => url.startsWith('rtmp://') || url.startsWith('rtsp://') || url.endsWith('.m3u8')

module.exports = { chmod, execCmd, getNetwork, download, isSupportedUrl }
