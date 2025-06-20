module.exports = {
    ERROR_CODE: ['8', '183', '196', '251'],
    DEFAULT_OPTIONS: {
        port: 8081,
        downloadDir: '/media/', 
        webhooks: '',
        webhookType: 'bark',
        thread: false,
        autoInstallFFmpeg: true,
        maxDownloadNum: 5,
        preset: 'medium',
        outputformat: 'mp4',
        enableTimeSuffix: false,
    },
    // 支持的视频格式
    OUTPUTFORMAT_OPTIONS: ['mp4', 'mov', 'flv', 'avi', 'mkv', 'ts'],
    // 支持的ffmpeg preset
    PRESET_OPTIONS: ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'],
}
