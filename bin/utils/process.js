/** process operation、file download、cmd exec  */
const childProcess = require('child_process')
const process = require('process')
const pidusage = require('pidusage')

const KILLPROCEETIMEOUT = 300000 // 300000

class FFmpegKiller {
    constructor () {
        this.pidCpu = {}
        this.timer = null
        this.time = KILLPROCEETIMEOUT
    }

    cpuUsageIsLow (usageList) {
        return usageList.every(i => i <= 0.03)
    }

    killPidAtLowusage (pid) {
        const _this = this
        pidusage(pid, function (err, result) {
            if (err) {
                console.log('get pid usage error:' + err) 
            } else {
                if (_this.pidCpu[pid]) {
                    _this.pidCpu[pid].push(result.cpu)
                } else {
                    _this.pidCpu[pid] = [result.cpu]
                }
                if (_this.pidCpu[pid].length > 4) {
                    const isDeadth = _this.cpuUsageIsLow(_this.pidCpu[pid].slice(-4))
                    if (!isDeadth) return
                    console.log('CPU usage is too low, killing process:' + pid, result.cpu)
                    process.kill(pid)
                    delete _this.pidCpu[pid]
                }
            }
        })
    }

    getProcessPidByQuery (query, cb) {
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

    ffmpegKill () {
        this.getProcessPidByQuery('ffmpeg -i', list => list.forEach((i) => this.killPidAtLowusage(i)))
    }

    killToDeathFfmeg () {
        this.ffmpegKill()
        this.timer = setInterval(() => {
            this.ffmpegKill()
        }, this.time)
    }

    clear () {
        if (this.timer) {
            clearInterval(this.timer)
        }
    }
} 

const ffmpegKiller = new FFmpegKiller()

module.exports = { ffmpegKiller }
