const express = require('express')
const compression = require('compression')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const ws = require('express-ws')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const cluster = require('cluster')
const fs = require('fs')
const path = require('path')
const colors = require('colors')
const i18n = require('./utils/locale')
const Utils = require('./utils/index')
const { TIME_SEC, SESSION } = require('./utils/constants')
const createUserRouter = require('./router/user')
const createDownloadRouter = require('./router/download')
const createSystemRouter = require('./router/system')
const createPluginRouter = require('./router/plugin')
const checkAuth = require('./middleware/checkAuth')
const requestLogger = require('./middleware/requestLogger')

const app = express()
const { getNetwork, initializeFrontEnd } = Utils

/**
 * @description
 * @param {FFandown} this
 */
function createServer ({ port, oimi }) {
    // registerEventCallback
    oimi.registerEventCallback((data) => {
        const { name, status } = data
        const isSuccess = status === '3'
        Utils.msg(
            oimi.config.webhooks, 
            oimi.config.webhookType, 
            i18n._('msg_title'),
                `${
                    isSuccess ?  
                        `${i18n._('download_success')}\n${i18n._('name')}: ${name}\n${i18n._('site')}: ${data.url}`: 
                        // eslint-disable-next-line max-len
                        `${i18n._('download_failed')}\n${i18n._('name')}: ${name}\n${i18n._('site')}: ${data.url}\n${i18n._('error_reason')}: ${data.message}`
                }`,
        )
        .then(() => Utils.LOG.info(i18n._('send_success')))
        .catch(e => {
            Utils.LOG.error(`${i18n._('send_failed')}: ` + e)
        })
    })

    // Gzip 压缩中间件
    app.use(compression({
        level: 6, // 压缩级别 (1-9)，6 是默认值，平衡压缩率和性能
        threshold: 1024, // 仅压缩大于 1KB 的响应
        filter: (req, res) => {
            // 仅压缩文本类内容
            if (req.headers['x-no-compression']) {
                return false
            }
            return compression.filter(req, res)
        },
    }))

    // Helmet 安全头中间件 - 提供更全面的安全头配置
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ['\'self\''],
                styleSrc: ['\'self\'', '\'unsafe-inline\''],
                scriptSrc: ['\'self\'', '\'unsafe-inline\'', '\'unsafe-eval\''],
                imgSrc: ['\'self\'', 'data:', 'https:'],
                fontSrc: ['\'self\''],
                connectSrc: ['\'self\'', 'ws:', 'wss:'],
            },
        },
        crossOriginEmbedderPolicy: false, // 禁用以防止与 WebSocket 冲突
    }))

    // Rate Limiter - 限制 API 请求频率
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 分钟
        max: 100, // 每个 IP 最多 100 个请求
        message: {
            code: 429,
            message: 'Too many requests from this IP, please try again later.',
        },
        standardHeaders: true, // 返回 RateLimit-* 头
        legacyHeaders: false, // 禁用 X-RateLimit-* 头
        handler: (req, res) => {
            Utils.LOG.warn(`Rate limit exceeded for IP: ${req.ip}`)
            res.status(429).json({
                code: 429,
                message: i18n._('too_many_requests') || 'Too many requests, please try again later.',
            })
        },
    })
    app.use('/sys/', limiter) // 对系统配置 API 应用速率限制
    app.use('/user', limiter) // 对用户 API 应用速率限制
    app.use('/plugin', limiter) // 对插件 API 应用速率限制

    // 使用请求计时中间件
    app.use(requestLogger)

    // express static server - 增加缓存控制
    const staticOptions = {
        dotfiles: 'ignore',
        etag: true,
        index: ['index.html'],
        maxAge: TIME_SEC.DAY * 7, // 静态文件缓存 7 天
        lastModified: true,
        setHeaders: (res, path) => {
            // 为不同类型的文件设置不同的缓存策略
            if (path.endsWith('.html')) {
                res.setHeader('Cache-Control', 'public, max-age=300') // HTML 文件缓存 5 分钟
            } else if (path.endsWith('.js') || path.endsWith('.css')) {
                res.setHeader('Cache-Control', 'public, max-age=604800, immutable') // 带哈希的 JS/CSS 缓存 7 天
            } else if (path.match(/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
                res.setHeader('Cache-Control', 'public, max-age=86400') // 其他静态资源缓存 1 天
            }
        },
    }
    app.use(express.static(path.join(process.cwd(), 'public'), staticOptions))

    // 配置 session 中间件
    if (!fs.existsSync('./sessions')) {
        fs.mkdirSync('./sessions', { recursive: true })
    }
    app.use(
        session({
            store: new FileStore({
                logFn: () => {},
                useAsync: false,
                encoding: 'utf8',
                ttl: TIME_SEC.DAY,  // Session TTL (1 day) Session 过期时间（1天）
                retries: 0,  // 减少重试次数
                reapInterval: TIME_SEC.HOUR,  // Cleanup interval for expired sessions (1 hour) 每小时清理过期session
                path: './sessions',
            }),
            secret: oimi.config?.secret, // Session secret for encryption Session 加密密钥
            resave: false, // 避免每次请求都重新保存会话
            saveUninitialized: false, // 只保存已修改的会话
            cookie: {
                sameSite: 'lax',
                maxAge: Number(oimi.config?.cookieMaxAge ?? SESSION.COOKIE_MAX_AGE), // 支持从配置自定义免登录时长 (默认7天)
            },
        }),
    )

    app.use((req, res, next) => {
        const userLang = req.headers['accept-language'] || 'en'
        i18n.setLocale(userLang) // 使用自定义 `setLocale` 方法
        next()
    })
    app.use(express.json())
    app.use(checkAuth)
    app.use('/sys/', createSystemRouter(oimi))
    app.use('/user', createUserRouter(oimi))
    app.use('/plugin', createPluginRouter(oimi))
    app.use('/', createDownloadRouter(oimi))
    // websocket
    ws(app).getWss('/')
    app.ws('/ws', (ws) => {
        ws.send(Utils.sendWsMsg('connected'))
        ws.on('message', async (msg) => {
            try {
                const data = JSON.parse(msg)
                const { key } = data
                if (key === 'list') {
                    const list = await oimi.dbOperation.DownloadService.getAll()
                    ws.send(Utils.sendWsMsg(list, 'list'))
                } else if(key === 'page') {
                    const { current, pageSize, status } = data
                    const list = await oimi.getMissionList(current, pageSize, status)
                    ws.send(Utils.sendWsMsg(list, 'page'))
                }
            } catch (e) {
                Utils.LOG.error('client:' + e)
            }
        })
        ws.on('close', function () {
            Utils.LOG.info('Close connection')
        })
    })

    app.listen(port, async () => {
        // initial front end resouce
        try {
            await initializeFrontEnd()
        } catch (e) {
            // download frontend static file error;
            Utils.LOG.error(e)
            console.warn(colors.red(e))
            process.exit(0)
        }
        const list = await getNetwork()
        const listenString = list.reduce((pre, val) => {
            return pre + `\n ${colors.white('   -')} ${colors.blue('http://' + val + ':' + port + '/')}`
        }, colors.white('[ffandown] server running at:\n'))
        const isWorker = cluster.isWorker
        if (isWorker && cluster.worker.id === 1 || !isWorker) {
            console.log(colors.green(listenString))
        }
    })
}

module.exports = createServer