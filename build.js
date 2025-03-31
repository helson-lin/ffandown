#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
// 源文件路径（根据你的项目结构调整）
let isDebug = true
let releaseName
const argv = process.argv.slice(2)
if (argv && argv[0] === '--debug') isDebug = true
const sourcePath = path.join(__dirname, 'package/')
// 目标路径
const nodeSqlite3targetPath = path.join(__dirname, 'node_modules/sqlite3/build/Release/')
const bcryptTargetPath = path.join(__dirname, 'node_modules/bcrypt/lib/binding/napi-v3')
const moveNodeSqlite = (targetPlatform, packageName = 'node_sqlite3', targetPath = nodeSqlite3targetPath) => {
    // 根据目标平台选择正确的文件
    let targetFile
    const name = targetPlatform.split('-').slice(1).join('-')
    switch (name) {
        case 'linux-x64':
            targetFile = `linux_x64_${packageName}.node`
            break
        case 'linux-arm64':
            targetFile = `linux_arm64_${packageName}.node`
            break
        case 'macos-arm64':
            targetFile = `macos_arm64_${packageName}.node`
            break
        case 'macos-x64':
            targetFile = `macos_x64_${packageName}.node`
            break
        case 'alpine-x64':
            targetFile = `alpine_x64_${packageName}.node`
            break
        case 'alpine-arm64':
            targetFile = `alpine_arm64_${packageName}.node`
            break
        case 'windows-x64':
            targetFile = `windows_x64_${packageName}.node`
            break
        case 'windows-arm64':
            targetFile = `windows_arm64_${packageName}.node`
            break
        default:
            console.error(`\n ❗️ Unsupported target platform：${targetPlatform} \n`)
    }
    if (targetFile) {
        console.log(`\n 🚀 start copy ${path.join(sourcePath, targetFile)} to ${ path.join(targetPath, `${packageName}.node`)}\n`)
        if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true })
        // 复制文件
        fs.copyFileSync(
            path.join(sourcePath, targetFile),
            path.join(targetPath, `${packageName}.node`),
        )

        console.log(
      `\n ✅ Copied \n${path.join(sourcePath, targetFile)} to \n${path.join(
          targetPath,
          `${packageName}.node`,
      )}\n`,
        )
    }
}

const pkgRelease = (targetPlatform) => {
    moveNodeSqlite(targetPlatform)
    moveNodeSqlite(targetPlatform, 'bcrypt_lib', bcryptTargetPath)
    // 执行打包命令
    execSync(
    `pkg . -t ${targetPlatform} --output ./dist/${releaseName}${targetPlatform.replace(/node\d+/g, '')}${targetPlatform.indexOf('windows') !== -1 ? '.exe' : ''
    }` + (isDebug ? ' --debug' : ''),
    { stdio: 'inherit' },
    )
}

const start = () => {
    try {
        console.log('🚀 start read package.json')
        // 读取 package.json
        const dataString = fs.readFileSync(
            path.join(__dirname, 'package.json'),
            'utf-8',
        )
        const data = JSON.parse(dataString)
        const platforms = data.pkg.targets
        releaseName = data.name
        console.log('🚀 read package.json success')
        console.log('🚀 start build')
        // 遍历 platforms 数组，执行打包命令
        for (let item of platforms) {
            pkgRelease(item)
        }
    } catch (e) {
        console.error('❗️ read package.json failed', e)
    }
}

start()
