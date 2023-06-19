# <p align="center" style="display: flex;justify-content: center;"><img style="margin-right: 20px; width: 40px;" src="https://pic.kblue.site/picgo/ffandown.svg"/> FFandown</p>

<p align="center">ffandown是一个基于ffmpeg实现的m3u8视频下载器。</p>
<p align="center">ffandown is a m3u8 video downloader that is based on ffmpeg.</p>
<p align="center">
    <a href="https://hub.docker.com/r/h55205l/ffandown">
        <img alt="docker image size" src="https://img.shields.io/docker/image-size/h55205l/ffandown"/>
    </a>
    <a href="https://hub.docker.com/r/h55205l/ffandown">
        <img alt="docker pulls" src="https://img.shields.io/docker/pulls/h55205l/ffandown?style=social"/>
    </a>
    <a href="https://github.com/helson-lin/ffandown">
          <img alt="release downloads" src="https://img.shields.io/github/downloads/helson-lin/ffandown/total?color=brightgreen&label=release%20download"/>
    </a>
    <a href="https://github.com/helson-lin/ffandown">
        <img alt="docker image size" src="https://img.shields.io/badge/platform-macos%7Clinux%7Cwin-brightgreen"/>
    </a>
     <a href="https://github.com/helson-lin/ffandown">
        <img alt="docker image size" src="https://img.shields.io/github/last-commit/helson-lin/ffandown"/>
    </a>
    <a href="/README.zh-CN.md">
        <img alt="lang" src="https://img.shields.io/badge/Lang-CN-brightgreen" />
    </a>
</p>

## Version Description

## v4.2.2
fix: fix permission judgement error of ffmpeg
feat:  add batch URL support: pass multiple URLs separated by commas
`https://s8.fsvod1.com/20230428/VTjjzmIu/index.m3u8,https://s8.fsvod1.com/20230524/bW0SZkHJ/index.m3u8`

## v4.2.1
fix: Fixed m3u8 download 403 error
perf: change ffmpeg binary download site to oss

### v4.2
Added log splitting
Fixed dark theme font color issue
Added version update prompt

### Version 4.1

perf: Optimized the problem of ffmpeg download process timeout (death) and failure to clear the process
feat: Added support for screen recording: rtsmp/rtmp, automatically terminated after the live broadcast ends

### Version 3
✨ feat:
1. Added multi-threaded transcoding,
2. Supported DingTalk message notification,
3. Added automatic generation of configuration files,
4. Optimized Docker build method.

🐞 fix:
1. Fixed the failure issue of bark notification,
2. Modified the config configuration directory.


### Version 2

Basic version: supports m3u8 video download and notification through Bark and Feishu, but has bugs. 
This version requires downloading the `config.yml` file and the corresponding platform's executable file, and placing them in the same directory. It is not recommended to use this version.

## Release Notes

The release platform executable file is packaged for commonly used platforms only. For other platform architectures, please use Docker or package them yourself.

## Docker Installation

CMD:  `docker run -d -p 8081:8081 -v /home/media:/app/media  -v /Uses/helson/config:/app/config h55205l/ffandown:v3`

- `/home/media` is the directory for downloading media, and the default port is 8081
- `/Uses/helson/config` is the directory for configuration files.

## About the `config.yml` Configuration File

If the `config.yml` configuration file is not found, the default configuration will be used and the configuration file will be automatically created in the `config` folder under the running directory.

- port: The port on which the service listens.
- downloadDir: The download directory, relative to the location of the executable file, or an absolute path (prefixed with `@`).
- webhooks: The webhook notification address, which can use software such as DingTalk or Bark. `$TEXT` is a variable representing the name of the downloaded file (note that the variable is in all uppercase letters and only supports Bark)!!! Please manually modify the address⚠️
- webhookType: `bark` | `'feishu'` ｜ `'dingding'`
- thread: Whether to enable the Express multi-threaded service (disabled by default).
- downloadThread: Whether to enable `ffmpeg` multi-threaded transcoding.
- useFFmpegLib: Whether to automatically include ffmpeg. When the service starts, it will automatically download the corresponding platform's ffmpeg. If not enabled, it defaults to the local environment.


## Usage

After the service is started, you can see the message `server runing on port: 8081`. Simply open `localhost:8081` in a browser to see the download page.

![](https://pic.kblue.site/picgo/localhost_8081_.png)


Alternatively, you can create a download using the API interface:
- Interface address: `http://localhost:8081/down`
- Request method: `POST`
- Request header: `Content-Type`: `application/json`
- Parameters: 
    ```js
    {
        name: "videoname",
        url: "http://playertest.longtailvideo.com/adaptive/bipbop/gear4/prog_index.m3u8"
    }
    ```


## Configuration of iOS Shortcuts

[iOS Shortcuts download link✈️](https://www.icloud.com/shortcuts/b185d44fb6574db29c79cb193e5bb079)

Before using it, remember to edit the instruction and modify the server's IP address and port.

## PS

You can deploy it on Linux or other servers to download `m3u8` videos to NAS. Currently, most small website videos are `m3u8` videos.