/* eslint-disable camelcase */
const fetch = require('node-fetch')
const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')
const download = require('download')
const log = require('./log')

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

const getLocalVersionInfo = () => {
    try {
        const version = fse.readFileSync(path.join(process.cwd(), 'public', 'version.json'), 'utf-8')
        return JSON.parse(version)
    } catch (e) {
        return null
    }
}

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

const getFrontEndVersion = async () => {
    const versionInfo = await getLatestVersion()
    const localVersionInfo = getLocalVersionInfo()
    if (!localVersionInfo) return { ...versionInfo, current: null, upgrade: false }
    const { version, upd } = localVersionInfo
    const upgrade = compareVersion(versionInfo.version, version) === 1
    return { ...versionInfo, current: localVersionInfo.version, upgrade, upd }
}

const isEmptyFrontEndResource = () => {
    fse.ensureDirSync(path.join(process.cwd(), 'public'))
    const allFiles = fs.readdirSync(path.join(process.cwd(), 'public'))
    if (allFiles.filter(filename => !['.DS_Store'].includes(filename)).length === 0) {
        return true
    } else {
        return false
    }
}

const moveDistFile = () => {
    const allFiles = fs.readdirSync(path.join(process.cwd(), 'public', 'dist'))
    allFiles.forEach(file => {
        fse.moveSync(
            path.join(process.cwd(), 'public', 'dist', file), 
            path.join(process.cwd(), 'public', file), 
            { overwrite: true },
        )
    })
    fse.removeSync(path.join(process.cwd(), 'public', 'dist'))
}

const addVersionFile = (version, msg, upd = new Date().getTime()) => {
    fse.writeFileSync(path.join(process.cwd(), 'public', 'version.json'), JSON.stringify({ version, msg, upd }))
}

const autoUpdateFrontEnd = async () => {
    const ORA = await import('ora')
    const ora = ORA?.default
    const spinner = ora({ 
        text: `auto update frontend`,
    })
    spinner.prefixText = '[ffandown]'
    spinner.start()
    try {
        const { version, urls } = await getLatestVersion()
        const { browser_download_url } = urls[0]
        if (!browser_download_url) throw new Error('no latest release url found')
        fse.ensureDirSync(path.join(process.cwd(), 'public'))
        fse.emptyDirSync(path.join(process.cwd(), 'public'))
        // add download supported log
        spinner.info('downloading new version frontend')
        await download('https://nn.oimi.space/' + browser_download_url, path.join(process.cwd(), 'public'), {
            filename: 'ffandown.zip',
            extract: true,
        })
        spinner.info('moving static file')
        moveDistFile()
        spinner.info('generate version file')
        addVersionFile(version, '自动更新成功')
        spinner.succeed('update frontend succeed')
    } catch (e) {
        spinner.fail('check update failed:')
        throw e;
    }
}

const initializeFrontEnd = async () => {
    const isEmpty = isEmptyFrontEndResource()
    if (isEmpty) await autoUpdateFrontEnd()
}

module.exports = { autoUpdateFrontEnd, getLatestVersion, getFrontEndVersion, initializeFrontEnd }