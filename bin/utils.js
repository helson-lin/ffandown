
const path = require("path");
const YAML = require('yamljs');
const colors = require('colors');
const fs = require("fs");
const fse = require('fs-extra');
const { exec } = require("child_process");
const m3u8ToMp4 = require("./m3u8");
const converter = new m3u8ToMp4();
const getConfigPath = () => {
    const configPathList = [path.join(process.cwd(), 'config.yml'), path.join(process.cwd(), '../config.yml')]
    return configPathList.find(_path => fse.pathExistsSync(_path));
}

const EnsureDonwloadPath = (_path) => {
    if (_path.startsWith('@')) {
        const relPath = _path.replace('@', '');
        fse.ensureDirSync(relPath);
        return relPath;
    }
    const relPath = path.join(process.cwd(), _path);
    fse.ensureDirSync(relPath);
    return relPath

}

const readConfig = (option =
    { port: 8080, downloadDir: path.join(process.cwd(), 'media'), webhooks: '', thread: true, useFFmpegLib: true }) => {
    const configPath = getConfigPath()
    if (!configPath) {
        logger.info(`not found config file`);
    } else {
        const data = YAML.parse(fs.readFileSync(configPath).toString());
        const { port, path, webhooks, thread, useFFmpegLib } = data;
        if (port) option.port = port
        if (path) option.downloadDir = EnsureDonwloadPath(path)
        if (webhooks) option.webhooks = webhooks
        if(thread !== undefined) option.thread = thread
        if(useFFmpegLib !== undefined) option.useFFmpegLib = useFFmpegLib
    }
    return option;
}

const download = (url, name, filePath, webhooks, ffmpegPath) => {
    return new Promise((resolve, reject) => {
        converter
            .setInputFile(url)
            .setOutputFile(filePath)
            .start()
            .then(res => {
                if (webhooks) {
                    console.log("下载成功：" + name)
                    const curlURl = webhooks.replace('$TEXT', '${name}.mp4')
                    console.log(`curl ${curlURl}`)
                    exec(`curl ${curlURl}`)
                }
                resolve()
            }).catch(err => {
                console.log("下载失败：" + err)
                if (webhooks) {
                    const curlURl = webhooks.replace('$TEXT', '${name}.mp4 Failed')
                    console.log(`curl ${curlURl}`)
                    exec(`curl ${curlURl}`)
                }
                reject(err)
            })
    })
}

const isFile = (pathDir) => fse.statSync(pathDir).isFile()

const FFMPEGPath = (suffx) => {
    const cwdPath = process.cwd() + suffx;
    const cdPath = path.join(process.cwd(), '..' + suffx)
    try {
        return isFile(cwdPath) ? cwdPath : cdPath
    } catch (e) {
        console.log(e)
    }
}

const setFfmpegEnv = function () {
    let baseURL = ''
    if (process.platform === 'win32') {
        baseURL = FFMPEGPath('/lib/ffmpeg-win/ffmpeg.exe');
    } else if (process.platform === 'darwin') {
        baseURL = FFMPEGPath('/lib/ffmpeg-mac/ffmpeg');
    } else if (process.platform === 'linux') {
        baseURL = FFMPEGPath('/lib/ffmpeg-linux/ffmpeg');
    } else {
        baseURL = 'ffmpeg'
    }
    if(process.env.FFMPEG_PATH !== baseURL ) {
        process.env.FFMPEG_PATH = baseURL
        console.log( colors.italic.cyan("[ffdown] ffmpeg: 环境变量设置成功 \n"))
    }
};

module.exports = {
    readConfig,
    download,
    setFfmpegEnv
}