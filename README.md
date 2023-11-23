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

## Release Notes

suggest to use version v4.1 or higher

The release platform executable file is packaged for commonly used platforms only. For other platform architectures, please use Docker or package them yourself.
[Release](https://github.com/helson-lin/ffandown/releases)

## Usage

[Full Usage Documentation](https://ffandown.oimi.space)

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