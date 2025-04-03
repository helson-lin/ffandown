const express = require('express')
const ws = require('express-ws')
const session = require('express-session')
const FileStore = require('session-file-store')(session)
const cluster = require('cluster')
const fs = require('fs')
const path = require('path')
const colors = require('colors')
const i18n = require('./utils/locale')
const Utils = require('./utils/index')
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
    // express static server
    app.use(express.static(path.join(process.cwd(), 'public')))
    // 使用请求计时中间件
    app.use(requestLogger)
    // 配置 session 中间件
    if (!fs.existsSync('./sessions')) {
        fs.mkdirSync('./sessions', { recursive: true })
    }
    app.use(
        session({
            store: new FileStore({ 
                useAsync: false, 
                encoding: 'utf8',
                ttl: 86400, // 1天
                retries: 0,  // 减少重试次数
                reapInterval: 3600, // 每小时清理过期session
                path: './sessions',
            }),
            secret: oimi.config?.secret, // 替换为你自己的密钥，用于加密
            resave: false, // 避免每次请求都重新保存会话
            saveUninitialized: false, // 只保存已修改的会话
            cookie: {
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000, // 设置 cookie 有效期为 1 天（免登录时长）
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
            Utils.LOG.info('close connection')
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