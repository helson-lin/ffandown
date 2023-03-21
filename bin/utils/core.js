/** process operation、file download、cmd exec  */
const childProcess = require('child_process')
const process = require('process')
const pidusage = require('pidusage')
const si = require('systeminformation')
const os = require('os')
const m3u8ToMp4 = require('../m3u8')
const logger = require('../log')
const { msg } = require('./message')
const converter = new m3u8ToMp4()
const cpuNum = os.cpus().length

const KILLPROCEETIMEOUT = 3000 // 300000
/**
 * @description kill a process by pid 
 * @param {string} pid process pid
 */
const killPidAtLowusage = (pid) => {
    pidusage(pid, function (err, result) {
        if (err) {
            console.log('get pid usage error:' + err) 
        } else if (result.cpu + '' === '0') {
            console.log('CPU usage is too low, killing process:' + pid, result.cpu)
            logger.warn('CPU usage is too low, killing process:' + pid, result.cpu)
            process.kill(pid)
        } else {
            console.log('FFMPEG PID:' + pid + ', CPU:' + result.cpu)
        }
    })
}
/**
 * @description query process pid by keywords
 * @param {string} query 
 * @param {function} cb callback 
 */
const getProcessPidByQuery = (query, cb) => {
    let platform = process.platform
    let cmd = ''
    switch (platform) {
        case 'win32':
            cmd = 'tasklist'
            break
        case 'darwin':
            cmd = `ps -ax | grep ${query}`
            break
        case 'linux':
            cmd = 'ps -A'
            break
        default:
            break
    }
    childProcess.exec(cmd, (err, stdout, stderr) => {
        if (err) {
            console.log('Exec findProcess error:' + err)
        }
        if (stdout) {
            const list = stdout
            .split(/[\r\n\t]/)
            .filter((i) => i && i.indexOf('grep') === -1)
            const queryList = list
            .filter((i) => i.includes(query))
            .map((string) => string.match(/\d+/)[0])
            cb(queryList)
        }
    })
}
/**
 * @description kill death ffmpeg process
 */
const killToDeathFfmeg = () => {
    const ffmpegKill = () => getProcessPidByQuery('ffmpeg -i', list => list.forEach((i) => killPidAtLowusage(i)))
    ffmpegKill()
    setInterval(() => {
        ffmpegKill()
    }, KILLPROCEETIMEOUT)
}

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
    // if(process.platform !== 'linux' || process.platform !== 'darwin') return
    const cmd = `chmod +x ${file}`
    execCmd(cmd)
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
 * @description: download m3u8 video to local storage
 * @param {string} url m3u8 url
 * @param {string} name fielName
 * @param {string} filePath file output path
 * @param {string} webhooks webhooks url
 * @param {string} webhookType webhooks type
 * @return {Promise}
 */
const download = (url, name, filePath, { webhooks, webhookType, downloadThread }) => {
    return new Promise((resolve, reject) => {
        converter
        .setInputFile(url)
        .setThreads(downloadThread ? cpuNum : 0)
        .setOutputFile(filePath)
        .start()
        .then(res => {
            if (webhooks) {
                console.log('下载成功：' + name)
                msg(webhooks, webhookType, `${name}.mp4 下载成功`)
            }
            resolve()
        }).catch(err => {
            console.log('下载失败', webhooks)
            console.log('下载失败：' + err)
            if (webhooks) {
                msg(webhooks, webhookType, `${name}.mp4 下载失败`, err + '')
            }
            reject(err)
        })
    })
}

module.exports = { killToDeathFfmeg, chmod, getNetwork, download }
