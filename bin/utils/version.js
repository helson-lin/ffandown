const fetch = require('node-fetch')
const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')
const download = require('download')
const log = require('./log')

const SYSYTEM_VERSION = 'v5.1.5.2'

/**
 * 获取最新版本信息 通过 github api https://ipera.oimi.space/为加速镜像
 * @param {string} repo 仓库名称
 * @returns {object}
 */
const getLatestVersion = async (repo = 'ffandown-front') => {
    // eslint-disable-next-line max-len
    const response = await fetch(`https://ipera.oimi.space/https://api.github.com/repos/helson-lin/${repo}/releases/latest`)
    const data = await response.json()
    const { tag_name, assets, body } = data
    return {
        version: tag_name,
        urls: assets,
        body,
    }
}

/**
 * 通过oss获取最新版本信息 （不走 github api 是为了国内用户）
 * @returns {object}
 */
const getLatestVersionByOss = async () => {
    const response = await fetch(`https://storage.helson-lin.cn/ffandown-front/release.json?time=${Date.now()}`)
    const data = await response.json()
    return {
        version: data.tag_name,
        urls: data.assets,
        body: data.body || data?.data,
    }
}

/**
 * 获取本地版本信息
 * @returns {object}
 */
const getLocalVersionInfo = () => {
    try {
        const version = fse.readFileSync(path.join(process.cwd(), 'public', 'version.json'), 'utf-8')
        return JSON.parse(version)
    } catch (e) {
        return null
    }
}

/**
 * 比较版本号
 * @param {string} version1 版本号1
 * @param {string} version2 版本号2
 * @returns {number} 1: version1 > version2, 0: version1 = version2, -1: version1 < version2
 */
const compareVersion = (version1, version2) => {
    const vvs = (version) => version.replaceAll('v', '').split('.')
    const compareVersions = (v1, v2) => {
        const len = Math.max(v1.length, v2.length)
        const arr = []
        for (let i = 0; i < len; i++) {
            const n1 = parseInt(v1[i]) || 0
            const n2 = parseInt(v2[i]) || 0
            if (n1 > n2) {
                arr.push(1)
            } else if (n1 < n2) {
                arr.push(-1)
            } else {
                arr.push(0)
            }
        }
        return arr.reduce((pre, val) => {
            if (val === 0 && pre === 0) return 0
            if (val === 1 && pre === 0) return 1
            if (pre === 1) return 1
            return -1
        }, 0)
    }
    return compareVersions(vvs(version1), vvs(version2))
}

/**
 * 获取前端版本信息
 * @returns {object}
 */
const getFrontEndVersion = async () => {
    const versionInfo = await getLatestVersionByOss()
    const localVersionInfo = getLocalVersionInfo()
    if (!localVersionInfo) return { ...versionInfo, current: null, upgrade: false }
    const { version, upd } = localVersionInfo
    const upgrade = compareVersion(versionInfo.version, version) === 1
    return { ...versionInfo, current: localVersionInfo.version, upgrade, upd,  backendVersion: SYSYTEM_VERSION }
}

/**
 * 判断前端资源是否为空
 * @returns {boolean}
 */
const isEmptyFrontEndResource = () => {
    fse.ensureDirSync(path.join(process.cwd(), 'public'))
    const allFiles = fs.readdirSync(path.join(process.cwd(), 'public'))
    if (allFiles.filter(filename => !['.DS_Store'].includes(filename)).length === 0) {
        return true
    } else {
        return false
    }
}

/**
 * 移动dist文件夹下的文件到public文件夹下
 */
const moveDistFile = () => {
    const allFiles = fs.readdirSync(path.join(process.cwd(), 'public', 'dist'))
    allFiles.forEach(file => {
        fse.moveSync(
            path.join(process.cwd(), 'public', 'dist', file), 
            path.join(process.cwd(), 'public', file), 
            { overwrite: true },
        )
    })
    // 删除dist文件夹
    fse.removeSync(path.join(process.cwd(), 'public', 'dist'))
}

/**
 * 保存保本信息到本地
 * @param {string} version 版本号
 * @param {string} msg 更新信息
 * @param {number} upd 更新时间
 */
const addVersionFile = (version, msg, upd = new Date().getTime()) => {
    fse.writeFileSync(path.join(process.cwd(), 'public', 'version.json'), JSON.stringify({ version, msg, upd }))
}

/**
 * 自动更新前端资源
 */
const autoUpdateFrontEnd = async () => {
    log.info('Ready to update frontend')
    // 获取最新的 oss 版本信息
    const { version, urls } = await getLatestVersionByOss()
    const browser_download_url = urls[0]
    if (!browser_download_url) throw new Error('no latest release url found')
    // 确保 public 文件夹存在
    fse.ensureDirSync(path.join(process.cwd(), 'public'))
    // 清空 public 文件夹
    fse.emptyDirSync(path.join(process.cwd(), 'public'))
    log.info('Start download frontend static file')
    // 下载前端资源并解压
    await download(browser_download_url + `?tm=${Date.now()}`, path.join(process.cwd(), 'public'), {
        filename: 'ffandown.zip',
        extract: true,
    })
    // 移动 dist 文件夹下的文件到 public 文件夹下
    moveDistFile()
    // 添加版本信息到本地
    addVersionFile(version, 'Update successfully')
    log.info('Frontend update successfully')
}

/**
 * 初始化前端资源
 */
const initializeFrontEnd = async () => {
    const isEmpty = isEmptyFrontEndResource()
    // 如果前端资源为空，则自动更新
    if (isEmpty) await autoUpdateFrontEnd()
}

module.exports = { autoUpdateFrontEnd, getLatestVersion, getFrontEndVersion, initializeFrontEnd, SYSYTEM_VERSION }