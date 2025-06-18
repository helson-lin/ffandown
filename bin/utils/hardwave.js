const ffmpeg = require('fluent-ffmpeg')
const { exec } = require('child_process')
const log = require('./log.js')

class HardWareDetect {
    hardwareAccel = null
    #detectPromise = null // 私有字段，用于存储检测的 Promise

    /**
     * @description 获取系统特定的硬件加速器映射表
     * @param {string} platform 系统平台
     * @returns {Object} 硬件加速器映射表
     */
    getHardwareAccelMap(platform) {
        const baseMap = {
            // NVIDIA GPU (跨平台)
            'nvenc': {
                encoder: 'h264_nvenc',
                hwaccel: 'cuda',
                desc: 'NVIDIA GPU (NVENC)',
                priority: 1,
                platforms: ['win32', 'linux', 'darwin'],
            },
            'cuda': {
                encoder: 'h264_nvenc',
                hwaccel: 'cuda',
                desc: 'NVIDIA GPU (CUDA)',
                priority: 1,
                platforms: ['win32', 'linux', 'darwin'],
            },
            // Intel Quick Sync (跨平台)
            'qsv': {
                encoder: 'h264_qsv',
                hwaccel: 'qsv',
                desc: 'Intel Quick Sync Video',
                priority: 2,
                platforms: ['win32', 'linux', 'darwin'],
            },
            // Apple VideoToolbox (macOS 专用)
            'videotoolbox': {
                encoder: 'h264_videotoolbox',
                hwaccel: 'videotoolbox',
                desc: 'Apple VideoToolbox',
                priority: 1,
                platforms: ['darwin'],
            },
            // VAAPI (Linux 专用)
            'vaapi': {
                encoder: 'h264_vaapi',
                hwaccel: 'vaapi',
                desc: 'Video Acceleration API (VAAPI)',
                priority: 3,
                platforms: ['linux'],
            },
            // DirectX Video Acceleration (Windows 专用)
            'dxva2': {
                encoder: 'h264_amf',
                hwaccel: 'dxva2',
                desc: 'DirectX Video Acceleration 2.0',
                priority: 4,
                platforms: ['win32'],
            },
            'd3d11va': {
                encoder: 'h264_amf',
                hwaccel: 'd3d11va',
                desc: 'Direct3D 11 Video Acceleration',
                priority: 3,
                platforms: ['win32'],
            },
            // AMD GPU
            'amf': {
                encoder: 'h264_amf',
                hwaccel: 'auto',
                desc: 'AMD Advanced Media Framework',
                priority: 2,
                platforms: ['win32'],
            },
            // OpenCL (跨平台，但优先级较低)
            'opencl': {
                encoder: 'h264_opencl',
                hwaccel: 'opencl',
                desc: 'OpenCL Hardware Acceleration',
                priority: 5,
                platforms: ['win32', 'linux', 'darwin'],
            },
        }

        // 过滤出当前平台支持的硬件加速器
        const platformMap = {}
        Object.entries(baseMap).forEach(([key, value]) => {
            if (value.platforms.includes(platform)) {
                platformMap[key] = value
            }
        })

        return platformMap
    }

    async selectBestHardwareAccel(platform, hwaccels, encoders, hwAccelMap, libPath) {
        const candidates = []
        const hwAccels = Object.entries(hwAccelMap)
        // 检查每个硬件加速器的可用性
        for (const hwAccel of hwAccels) {
            const [key, value] = hwAccel
            const hasHwAccel = hwaccels.some(line => line.includes(key))
            const hasEncoder = encoders.some(line => line.includes(value.encoder))
            const isWorking = await this.verifyHardwareAccel(libPath, value.encoder)
            if (hasHwAccel && hasEncoder && isWorking) {
                candidates.push({
                    key,
                    ...value,
                    score: this.calculateAccelScore(platform, key, value),
                })
            }
        }

        // 按分数排序，选择最佳选项
        candidates.sort((a, b) => b.score - a.score)
        return candidates
    }

    calculateAccelScore(platform, key, accelInfo) {
        let score = 100 - accelInfo.priority * 10 // 基础分数，优先级越高分数越高

        // 平台特定加分
        if (platform === 'darwin' && key === 'videotoolbox') {
            score += 20 // macOS 上 VideoToolbox 是最佳选择
        } else if (platform === 'win32' && (key === 'nvenc' || key === 'cuda')) {
            score += 15 // Windows 上 NVIDIA 通常性能最好
        } else if (platform === 'linux' && key === 'vaapi') {
            score += 10 // Linux 上 VAAPI 是不错的选择
        }

        // NVIDIA GPU 在所有平台都有额外加分
        if (key === 'nvenc' || key === 'cuda') {
            score += 10
        }

        // Intel QSV 在所有平台都比较稳定
        if (key === 'qsv') {
            score += 5
        }

        return score
    }

    /**
     * @description 验证硬件加速器是否真正可用
     * @param {string} libPath FFmpeg 可执行文件路径
     * @param {Object} accelInfo 硬件加速器信息
     * @returns {Promise<boolean>} 是否可用
     */
    async verifyHardwareAccel(libPath, encoder) {
        try {
            // 创建一个简单的测试命令来验证硬件加速是否工作
            const testCommand = `${libPath} -f lavfi -i testsrc=duration=1:size=320x240:rate=1 ` +
                `-c:v ${encoder} -t 1 -f null -`
            const result = await new Promise((resolve) => {
                exec(testCommand, { timeout: 10000 }, (err) => {
                    if (err) {
                        resolve(false)
                    } else {
                        resolve(true)
                    }
                })
            })

            return result
        } catch (error) {
            return false
        }
    }

    /**
     * @description 获取硬件加速配置（使用闭包缓存，避免重复检测）
     * @returns {Promise<Object|null>} 硬件加速配置或 null
     */
    async getHardwareAccel() {
        // 如果已经有检测结果，直接返回
        if (this.hardwareAccel !== null) {
            return this.hardwareAccel
        }

        // 如果正在检测中，等待检测完成
        if (this.#detectPromise) {
            await this.#detectPromise
            return this.hardwareAccel
        }

        // 开始新的检测
        this.#detectPromise = this.detectHardwareAccel()
        await this.#detectPromise
        this.#detectPromise = null // 检测完成后清空 Promise

        return this.hardwareAccel
    }

    async detectHardwareAccel() {
        try {
            const platform = process.platform
            const ffmpegCmd = ffmpeg()
            const libPath = await new Promise((resolve) => {
                ffmpegCmd._getFfmpegPath((_, path) => resolve(path))
            })

            // 检查硬件加速支持
            const hwaccelsOutput = await new Promise((resolve, reject) => {
                exec(`${libPath} -hwaccels`, (err, stdout) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve(stdout)
                })
            })

            // 检查可用编码器
            const encodersOutput = await new Promise((resolve, reject) => {
                exec(`${libPath} -encoders`, (err, stdout) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve(stdout)
                })
            })

            // 系统特定的硬件加速器映射表
            const hwAccelMap = this.getHardwareAccelMap(platform)
            // 按优先级顺序检查硬件加速器
            const hwaccels = hwaccelsOutput.toLowerCase().split('\n')
            .filter(i => i && Object.keys(hwAccelMap).includes(i))
            const encoders = encodersOutput.toLowerCase().split('\n')
            const selectedAccel = await this.selectBestHardwareAccel(platform, hwaccels, encoders, hwAccelMap, libPath)
            log.info(`Selected hardware acceleration: ${selectedAccel.map(i => i.encoder).join('、') || 'None'}`)
            if (selectedAccel.length >= 1) {
                this.hardwareAccel = selectedAccel[0]
            } else {
                this.hardwareAccel = null
            }

        } catch (error) {
            this.hardwareAccel = null
        }
    }
}

const hardWareDetect = new HardWareDetect()

module.exports = {
    hardWareDetect,
}