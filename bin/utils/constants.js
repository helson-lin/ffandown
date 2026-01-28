/**
 * Global constants and configuration values
 * 全局常量和配置值
 */

// Time constants in milliseconds 时间常量（毫秒）
const TIME = {
    // 1 second
    SECOND: 1000,
    // 1 minute
    MINUTE: 60 * 1000,
    // 1 hour
    HOUR: 60 * 60 * 1000,
    // 1 day
    DAY: 24 * 60 * 60 * 1000,
}

// Time constants in seconds 时间常量（秒）
const TIME_SEC = {
    // 1 hour in seconds
    HOUR: 3600,
    // 1 day in seconds
    DAY: 86400,
}

// Download configuration 下载配置
const DOWNLOAD = {
    // Default maximum concurrent downloads 默认最大并发下载数
    MAX_CONCURRENT: 5,

    // Default task thread count (per download) 默认任务线程数（每个下载）
    THREADS_PER_TASK: 3,

    // Download status constants 下载状态常量
    STATUS: {
        WAITING: 0,      // 等待中
        DOWNLOADING: 1,  // 下载中
        STOPPED: 2,      // 已停止
        COMPLETED: 3,    // 已完成
        ERROR: 4,        // 错误
        QUEUED: 5,       // 队列中
    },
}

// Session configuration Session 配置
const SESSION = {
    // Session TTL (1 day) Session 过期时间（1天）
    TTL: TIME_SEC.DAY,

    // Cleanup interval for expired sessions (1 hour) 清理过期 Session 的间隔（1小时）
    REAP_INTERVAL: TIME_SEC.HOUR,

    // Cookie max age (7 days) Cookie 最大年龄（7天）
    COOKIE_MAX_AGE: 7 * TIME.DAY,

    // Default session secret length 默认 session 密钥长度
    SECRET_LENGTH: 32,
}

// HTTP configuration HTTP 配置
const HTTP = {
    // Request timeout 请求超时时间
    TIMEOUT: 30 * 1000,

    // Max redirects 最大重定向次数
    MAX_REDIRECTS: 5,

    // User agent User-Agent
    USER_AGENT: 'FFandown/5.1.7',
}

// FFmpeg configuration FFmpeg 配置
const FFMPEG = {
    // Default preset 默认预设
    DEFAULT_PRESET: 'medium',

    // Default output format 默认输出格式
    DEFAULT_OUTPUT_FORMAT: 'mp4',

    // Timeout for FFmpeg operations FFmpeg 操作超时时间
    TIMEOUT: 5 * 60 * 1000,  // 5 minutes
}

// Log configuration 日志配置
const LOG = {
    // Default log level 默认日志级别
    DEFAULT_LEVEL: 'info',

    // Log file max size 日志文件最大大小
    MAX_FILE_SIZE: '20m',

    // Log file max count 日志文件最大数量
    MAX_FILES: '14d',
}

// API configuration API 配置
const API = {
    // Default port 默认端口
    DEFAULT_PORT: 8081,

    // Rate limit window (15 minutes) 速率限制窗口（15分钟）
    RATE_LIMIT_WINDOW: 15 * TIME.MINUTE,

    // Max requests per window 每个窗口的最大请求数
    RATE_LIMIT_MAX: 100,
}

// Memory cleanup configuration 内存清理配置
const CLEANUP = {
    // Maximum number of stop mission records to retain 停止任务记录最大保留数量
    MAX_STOP_MISSION_RETENTION: 100,

    // Maximum number of completed mission records to retain 完成任务记录最大保留数量
    MAX_COMPLETED_MISSION_RETENTION: 50,

    // Cleanup interval (every 30 minutes) 清理间隔（每30分钟）
    INTERVAL: 30 * TIME.MINUTE,

    // Auto-cleanup enabled by default 默认启用自动清理
    AUTO_CLEANUP_ENABLED: true,
}

// Database configuration 数据库配置
const DATABASE = {
    // Default database pool configuration 默认数据库连接池配置
    POOL: {
        // Maximum number of connections in pool 连接池最大连接数
        max: 10,

        // Minimum number of connections in pool 连接池最小连接数
        min: 0,

        // Maximum time (ms) to acquire a connection before throwing error 获取连接的超时时间
        acquire: 30000,

        // Maximum time (ms) a connection can be idle before being released 连接空闲超时时间
        idle: 10000,

        // Maximum time (ms) that a connection can be idle before being evicted 连接最大空闲时间
        evict: 60000,

        // Connection retry configuration 连接重试配置
        retry: {
            // Maximum number of connection retries 最大重试次数
            max: 3,

            // Delay between retries (ms) 重试间隔
            delay: 1000,
        },
    },

    // Database timeout configurations 数据库超时配置
    TIMEOUT: {
        // Statement timeout (ms) SQL 查询超时时间
        statement: 30000,

        // Database operation timeout (ms) 数据库操作超时时间
        operation: 60000,
    },
}

// Application default configuration 应用默认配置
const DEFAULT_OPTIONS = {
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
    cookieMaxAge: 7 * TIME.DAY,  // 7 days in milliseconds
}

// Error codes 错误代码
const ERROR_CODE = ['8', '183', '196', '251']

// Supported video formats 支持的视频格式
const OUTPUT_FORMAT_OPTIONS = ['mp4', 'mov', 'flv', 'avi', 'mkv', 'ts']

// Supported FFmpeg presets 支持的 FFmpeg 预设
const PRESET_OPTIONS = [
    'ultrafast',
    'superfast',
    'veryfast',
    'faster',
    'fast',
    'medium',
    'slow',
    'slower',
    'veryslow',
]

// Valid file extensions 有效的文件扩展名
const VALID_EXTENSIONS = [
    'mp4',
    'mov',
    'flv',
    'avi',
    'mkv',
    'm3u8',
    'ts',
    'mpd',
]

// Path validation regex 路径验证正则表达式
const PATH_REGEX = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/

// File name validation regex 文件名验证正则表达式
const FILENAME_REGEX = /^[a-zA-Z0-9._-]+$/

module.exports = {
    TIME,
    TIME_SEC,
    DOWNLOAD,
    SESSION,
    HTTP,
    FFMPEG,
    LOG,
    API,
    CLEANUP,
    VALID_EXTENSIONS,
    PATH_REGEX,
    FILENAME_REGEX,
    DEFAULT_OPTIONS,
    ERROR_CODE,
    OUTPUT_FORMAT_OPTIONS,
    PRESET_OPTIONS,
    DATABASE,
}
