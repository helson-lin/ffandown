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
    <a href="/README.md">
        <img alt="lang" src="https://img.shields.io/badge/Lang-CN-brightgreen" />
    </a>
    <a href="https://qm.qq.com/q/7EtNRkt2eI">
        <img alt="qq" src="https://img.shields.io/badge/QQ%E7%BE%A4-953172983-%234f4f4f?logo=data:image/png;base64,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&color=#4f4f4f" />
    </a>
        <a href="https://t.me/ffandown">
        <img alt="telegram" src="https://img.shields.io/badge/ffandown-brightgreen.svg?logo=telegram&color=#4F4F4F" />
    </a>
</p>


## User Guide
1. ✨ Currently supports downloading m3u8, rtsp, and rtmp live streams, as well as m3u8, mp4, and flv videos.
2. ✨ Supports download notifications (Bark, Feishu, DingTalk, Gotify).
3. ✨ Supports custom download transcoding formats (mp4, mov, flv, avi).
4. ✨ Supports custom request headers.
5. ✨ Full platform support.
6. ✨ Supports a plugin system (official version v5.0.0).
7. ✨ Supports proxy configuration.

## Project Setup
1. Install dependencies: `npm install`
2. Run the service: `npm run dev`


## Project Packaging

### PKG Packaging
Run `npm run pkg` in the terminal.

### Release Notes
The executable files for the release platform are pre-packaged for common platforms only. For other platforms or architectures, please use Docker or package them manually.

### Docker Installation
Shell command:

```shell
docker run -d -p 8081:8081 -v /home/media:/app/media -v /home/config:/app/config -v /home/logs:/app/logs h55205l/ffandown:latest
```

- `/app/media`: Directory for downloaded media. Default port is 8081.
- `/app/config`: Directory for configuration files.
- `/app/logs`: Directory for log files.
- `/app/lib`: FFmpeg、FFprobe Directory.
- `/app/public`: Directory for frontend static files.
- `/app/error-reports`: Error Report.

## Configuration File
```yml
port: 8381 # Server Port
downloadDir: /media/ # download directory
webhooks: https://nz.helson-lin.cn/message?token=A3HJgdetn8Rhh9g # webhook website
webhookType: gotify # webhook type: bark、gotify、FeiShu、DingDing
thread: true # Multithreaded transcoding
autoInstallFFmpeg: true # Auto Install FFmpeg
maxDownloadNum: 3 # Maximum simultaneous downloads
preset: medium # Transcoding preset
outputformat: mp4 # convert format
enableTimeSuffix: false # Enable timestamp suffix
secret: DJH1v3kXjV2v3oN4NHGlphZXyZGfmr3E # Authentication secret
proxy:  http://127.0.0.1:7897 # Proxy address
```


## Usage
After starting the service, you will see the message `server running on port: 8081`.
Open `localhost:8081` in your browser to access the download page.

![example](./example-en.png)

### Plugin List (Supported in v5.1.3 or the latest version)
| Plugin Name | Plugin URL | Repository | Description |
|------------|------------|------------|------------|
| bilibili | [GitHub](https://github.com/helson-lin/ffandown-plugin/releases/download/v0.0.2/index.js) | [GitHub](https://github.com/helson-lin/ffandown-plugin) | Supports Bilibili live streams and video parsing. Without setting cookies, only 480p downloads are available. |


### API for Creating Download Tasks
[API Documentation](https://apifox.com/apidoc/shared-d00c4b27-4841-4ecd-932c-b04bdc3b94cd)
- Endpoint: `http://localhost:8081/down`
- Method: `POST`
- Header: `Content-Type: application/json`
- Parameters:
    ```js
    {
        name: "videoname",
        url: "http://playertest.longtailvideo.com/adaptive/bipbop/gear4/prog_index.m3u8",
        audioUrl: '', // Audio URL (used for merging audio and video files)
        outputformat: "mp4",
        preset: "medium",
        username: "", // login user name
        password: "", // login user password
        dir: "/videos", // Save directory
        headers: [
            {
                key: 'User-Agent',
                value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        ]
    }
    ```

### Configuring iOS Shortcuts
[Download Shortcut ✈️](https://www.icloud.com/shortcuts/d839d5fab95c48e0ab59e72396ec8280)
Before using, remember to edit the shortcut and update the server IP address and port.

## Disclaimer
All risks arising from the use of this project are borne by the user. We are not responsible for any direct, indirect, incidental, special, or consequential damages caused by the use of this project, including but not limited to loss of profits, data loss, or other economic losses.
*Limitation of Liability*: To the maximum extent permitted by applicable law, the authors and contributors of this project shall not be liable for any losses caused by the use or inability to use the project.

## License
This project is licensed under the AGPLv3 License. For details, please refer to the LICENSE file.

## Acknowledgments
- [FFmpeg](https://ffmpeg.org/)
- [node-fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)

## Donations and Support
Special thanks to **Gentle**, **Xinzai** for their donations and support, and to **jk9527** for their technical contributions.

## Star History
[![Star History Chart](https://api.star-history.com/svg?repos=helson-lin/ffandown&type=Date)](https://star-history.com/#helson-lin/ffandown&Date)
