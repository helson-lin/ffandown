## Version Description

suggest to use version v4.1 or higher
 
## v4.2.1
1. 🐞 fix: Fixed m3u8 download 403 error
2. 🎈perf: change ffmpeg binary download site to oss

### v4.2
1. 🎈perf: Added log splitting
2. 🐞 fix: Fixed dark theme font color issue

### v4.1

1. 🎈perf: Optimized the problem of ffmpeg download process timeout (death) and failure to clear the process
2. ✨feat: Added support for screen recording: rtsmp/rtmp, automatically terminated after the live broadcast ends

### Version 3

1. ✨ feat: Added multi-threaded transcoding,
2. ✨ feat: Supported DingTalk message notification,
3. ✨ feat: Added automatic generation of configuration files,
4. 🎈 perf: Optimized Docker build method.
5. 🐞 fix: Fixed the failure issue of bark notification
6. 🐞 fix: Modified the config configuration directory.


### v2.0

Basic version: supports m3u8 video download and notification through Bark and Feishu, but has bugs. 
This version requires downloading the `config.yml` file and the corresponding platform's executable file, and placing them in the same directory. It is not recommended to use this version.