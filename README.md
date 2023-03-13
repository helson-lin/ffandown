# ffandown 

ffandown是一个m3u8视频下载器，基于ffmpeg实现视频的下载。

## lib文件

lib文件加下面是ffmpeg的可执行文件，默认程序自带了ffmpeg，并且使用的是本地自带的ffmpeg,如果你的电脑存在ffmpeg环境变量
可以自行在`config.yml`文件内关闭`useFFmpegLib: flase`

## releas说明

release平台可执行文件需要配置config.yml使用，请一同下载

## docker安装

`docker run -d -p 8081:80801 -v /home/media:/app/media  -v $PWD/config.yml:/app/config.yml h55205l/ffandown:v2`

`/home/media`为下载媒体的目录、默认8081端口


## 关于配置文件`config.yml`

- port: 服务监听的端口
- path: 下载目录，相对于执行文件位置，或者使用绝对路径（在地址前面加载@）
- webhookType: bark | 'feishu'
- webhooks: webhook通知地址，使用bark的时候支持变量`$TEXT`：下载文件的名称；使用飞书直接填写webhook地址即可
- thread: 是否开启多线程
- useFFmpegLib: 是否使用自带lib, 默认true，可以自动下载对应的依赖


## 使用

服务启动之后，可以看到`server runing on port: 8081`的字样
直接在浏览器打开`localhost:8081`就可以看到下载页面
或者自己使用接口创建下载，接口地址：`http://localhost:8081/down`, 请求方式：`post`,  `Content-Type`: `application/json`,参数: 
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
