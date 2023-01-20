
const path = require("path");
const YAML = require('yamljs');
const colors = require('colors');
const request = require('request')
const fs = require("fs");
const fse = require('fs-extra');
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
    { port: 8080, downloadDir: path.join(process.cwd(), 'media'), webhooks: '', webhookType: 'bark', thread: true, useFFmpegLib: true }) => {
    const configPath = getConfigPath()
    if (!configPath) {
        logger.info(`not found config file`);
    } else {
        const data = YAML.parse(fs.readFileSync(configPath).toString());
        const { port, path, webhooks, webhookType, thread, useFFmpegLib } = data;
        if (port) option.port = port
        if (path) option.downloadDir = EnsureDonwloadPath(path)
        if (webhooks) option.webhooks = webhooks
        if (webhookType) option.webhookType = webhookType
        if (thread !== undefined) option.thread = thread
        if (useFFmpegLib !== undefined) option.useFFmpegLib = useFFmpegLib
    }
    return option;
}

const getFeiShuBody = (text, More) => {
    const content = []
    if(text) {
        content.push([{
            "tag": "text",
            "text": `${text}`
        }])
    }
    if(More) {
        content.push([{
            "tag": "text",
            "text": `${More}`
        }])
    }
    return {
        msg_type: 'post',
        content: {
            post: {
                "zh_cn": {
                    "title": "文件下载通知",
                    "content": content
                }
            }
        }
    }
}

const getBarkUrl = (url, text) => url.replace('$TEXT', `${encodeURIComponent(text)}`)

const msg = (url, type, Text, More) => {
    const URL = type === 'bark' ? getBarkUrl(url, Text) : url
    const method = type === 'bark' ? 'GET' : 'POST'
    const bodyHanler = { bark: () => ({}), feishu: getFeiShuBody };
    const data = bodyHanler[type](Text, More)
    console.log(type, data)
    request({
        url: URL,
        method,
        body: JSON.stringify(data)
    })
}

const download = (url, name, filePath, { webhooks, webhookType }) => {
    return new Promise((resolve, reject) => {
        converter
            .setInputFile(url)
            .setOutputFile(filePath)
            .start()
            .then(res => {
                if (webhooks) {
                    console.log("下载成功：" + name)
                    msg(webhooks, webhookType, `${name}.mp4 下载成功`)
                }
                resolve()
            }).catch(err => {
                console.log("下载失败", webhooks)
                console.log("下载失败：" + err)
                if (webhooks) {
                    console.log("we", webhooks, webhookType)
                    msg(webhooks, webhookType, `${name}.mp4 下载失败！`, err + '')
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
    if (process.env.FFMPEG_PATH !== baseURL) {
        process.env.FFMPEG_PATH = baseURL
        console.log(colors.italic.cyan("[ffdown] ffmpeg: 环境变量设置成功 \n"))
    }
};

module.exports = {
    readConfig,
    download,
    msg,
    setFfmpegEnv
}