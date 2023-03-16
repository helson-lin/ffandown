# <p align="center" style="display: flex;justify-content: center;"><img style="margin-right: 20px; width: 40px;" src="https://pic.kblue.site/picgo/ffandown.svg"/> FFandown</p>

<p align="center">ffandown是一个m3u8视频下载器，基于ffmpeg实现视频的下载。
<p align="center">ffandown is a m3u8 video downloader,that base on ffmpeg</p>
<p align="center">
    <a href="https://hub.docker.com/r/h55205l/ffandown">
        <img alt="docker image size" src="https://img.shields.io/docker/image-size/h55205l/ffandown"/>
    </a>
    <a href="https://hub.docker.com/r/h55205l/ffandown">
        <img alt="docker pulls" src="https://img.shields.io/docker/pulls/h55205l/ffandown?style=social"/>
    </a>
    <a href="https://github.com/helson-lin/ffandown">
        <img alt="docker image size" src="https://img.shields.io/badge/platform-macos%7Clinux%7Cwin-brightgreen"/>
    </a>
     <a href="https://github.com/helson-lin/ffandown">
        <img alt="docker image size" src="https://img.shields.io/github/last-commit/helson-lin/ffandown"/>
    </a>
</p>

## releas说明

release平台可执行文件，打包仅打包了常用平台，其他平台架构请使用docker或自行打包

## docker安装

CMD:  `docker run -d -p 8081:8081 -v /home/media:/app/media  -v /Uses/helson/config:/app/config h55205l/ffandown:v3`

`/home/media`为下载媒体的目录、默认8081端口
`/Uses/helson/config`为配置文件目录

## 关于配置文件`config.yml`

如果没有config.yml配置文件会采用默认配置，并自动创建配置文件（运行目录config文件夹下面）。


- port: 服务监听的端口
- downloadDir: 下载目录，相对于执行文件位置，或者使用绝对路径（在地址前面加载@）
- webhooks: webhook通知地址，可以使用钉钉或者bark之类软件,`$TEXT`为变量：下载文件的名称（注意变量是纯大写的，仅支持bark）！！！请大家手动修改地址⚠️
- webhookType: bark | 'feishu' ｜ 'dingding'
- thread: 是否开启express 多线程服务（默认不开启）
- downloadThread: 是否开启`ffmpeg`多线程转码
- useFFmpegLib: 是否自动内置ffmpeg，启动服务会自动去下载对应平台的ffmpeg，不启动默认采用本地环境的


## 使用

服务启动之后，可以看到`server runing on port: 8081`的字样
直接在浏览器打开`localhost:8081`就可以看到下载页面

![](https://pic.kblue.site/picgo/localhost_8081_.png)


或者自己使用API接口创建下载
- 接口地址：`http://localhost:8081/down`
- 请求方式：`post`
- 请求头： `Content-Type`: `application/json`
- 参数: 
    ```js
    {
        name: "videoname",
        url: "http://playertest.longtailvideo.com/adaptive/bipbop/gear4/prog_index.m3u8"
    }
    ```


## 配置ios快捷指令使用

[快捷指令下载地址✈️](https://www.icloud.com/shortcuts/b185d44fb6574db29c79cb193e5bb079)

使用前记得先编辑指令，修改服务器的地址IP和端口


## PS

可以自行部署在linux或者其他服务器上，来实现`m3u8`的视频的下载到nas
基本目前的一些小网站视频都是`m3u8`的视频
