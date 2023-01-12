# ffandown 

ffandown是一个m3u8视频下载器，基于ffmpeg实现视频的下载。

## lib文件

lib文件加下面是ffmpeg的可执行文件，默认程序自带了ffmpeg，并且使用的是本地自带的ffmpeg,如果你的电脑存在ffmpeg环境变量
可以自行在`config.yml`文件内关闭`useFFmpegLib: flase`