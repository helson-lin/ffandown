/* eslint-env jest */

const express = require('express')
const http = require('http')
const session = require('express-session')
const request = require('supertest')
const EventEmitter = require('events')
const bcrypt = require('bcrypt')
const fse = require('fs-extra')

jest.mock('../bin/utils/index', () => {
    const getRealUrl = (str = '') => {
        if (typeof str !== 'string') return str
        if (str.includes('\n')) {
            const arr = str.split('\n').filter(Boolean)
            if (arr.length === 1) return arr[0]
            return arr
        }
        return str
    }
    return {
        LOG: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            verbose: jest.fn(),
            level: 'info',
        },
        modifyYml: jest.fn(),
        getFrontEndVersion: jest.fn().mockResolvedValue({
            version: 'v2.0.0',
            current: 'v1.0.0',
            upgrade: true,
        }),
        autoUpdateFrontEnd: jest.fn().mockResolvedValue(),
        getDirectories: jest.fn().mockResolvedValue([
            { label: '/media', value: '/media' },
        ]),
        msg: jest.fn().mockResolvedValue('sent'),
        getRealUrl,
        sendWsMsg: jest.fn((payload, type) => JSON.stringify({ payload, type })),
    }
})

jest.mock('../bin/utils/parser', () => ({
    autoParser: jest.fn(async (url) => ({ url: `${url}/parsed` })),
    getPlugin: jest.fn(async () => ({
        name: 'mock-plugin',
        author: 'dev',
        description: 'desc',
        version: '1.0.0',
        localUrl: '/tmp/mock-plugin.js',
        url: 'http://plugin.local/mock.js',
    })),
}))

jest.mock('../bin/sql/downloadService', () => ({
    create: jest.fn().mockResolvedValue({}),
    queryByPage: jest.fn().mockResolvedValue({
        count: 1,
        rows: [{ uid: '1', name: 'task' }],
        total: 1,
    }),
    queryOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(1),
    batchDelete: jest.fn().mockResolvedValue(1),
    update: jest.fn().mockResolvedValue(1),
    getAll: jest.fn().mockResolvedValue([]),
}))

jest.mock('../bin/sql/pluginService', () => ({
    queryByPage: jest.fn().mockResolvedValue({
        count: 1,
        rows: [{ uid: 'p1', name: 'plugin' }],
        total: 1,
    }),
    create: jest.fn().mockResolvedValue({ uid: 'p1' }),
    delete: jest.fn().mockResolvedValue({
        uid: 'p1',
        localUrl: '/tmp/plugin.js',
    }),
    batchDelete: jest.fn().mockResolvedValue([
        { uid: 'p1', localUrl: '/tmp/plugin.js' },
    ]),
    batchStatus: jest.fn().mockResolvedValue([
        { uid: 'p1', localUrl: '/tmp/plugin.js', url: 'http://plugin.local/mock.js' },
    ]),
    update: jest.fn().mockResolvedValue({ uid: 'p1' }),
}))

jest.mock('../bin/sql/userService', () => ({
    queryByUsername: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
}))

const Utils = require('../bin/utils/index')
const DownloadService = require('../bin/sql/downloadService')
const PluginService = require('../bin/sql/pluginService')
const UserService = require('../bin/sql/userService')
const { autoParser, getPlugin } = require('../bin/utils/parser')

const createDownloadRouter = require('../bin/router/download')
const createSystemRouter = require('../bin/router/system')
const createUserRouter = require('../bin/router/user')
const createPluginRouter = require('../bin/router/plugin')
const checkAuth = require('../bin/middleware/checkAuth')
const requestLogger = require('../bin/middleware/requestLogger')

const buildApp = (mountPath, router, { withSessionUser = true } = {}) => {
    const app = express()
    app.use(express.json())
    app.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: true,
    }))
    if (withSessionUser) {
        app.use((req, _res, next) => {
            req.session.user = { username: 'tester' }
            next()
        })
    }
    app.use(mountPath, router)
    return app
}

const setupTestServer = (mountPath, router, options) => {
    const app = buildApp(mountPath, router, options)
    const server = http.createServer(app)
    const agent = request(server)
    return { app, server, agent }
}

const createOimiStub = () => ({
    config: {
        preset: 'medium',
        outputformat: 'mp4',
        downloadDir: '/media',
        secret: 'test-secret',
        cookieMaxAge: 5000,
        webhooks: 'http://hook.local',
        webhookType: 'gotify',
    },
    createDownloadMission: jest.fn().mockResolvedValue({ uid: '1', name: 'mission' }),
    pauseMission: jest.fn().mockResolvedValue(),
    resumeDownload: jest.fn().mockResolvedValue(),
    deleteDownload: jest.fn().mockResolvedValue(),
    stopDownload: jest.fn().mockResolvedValue(),
    dbOperation: {
        DownloadService: {
            getAll: jest.fn().mockResolvedValue([]),
        },
    },
})

describe('Download Router', () => {
    let app
    let server
    let agent
    let oimi

    beforeEach(() => {
        oimi = createOimiStub()
        ;({ app, server, agent } = setupTestServer('/', createDownloadRouter(oimi)))
    })

    afterEach(() => {
        server?.close()
        jest.clearAllMocks()
    })

    it('creates download missions via POST /down', async () => {
        const res = await agent.post('/down').send({
            name: 'video',
            url: 'http://example.com/stream',
            dir: 'movies',
        })

        expect(res.status).toBe(200)
        expect(res.body.code).toBe(0)
        expect(oimi.createDownloadMission).toHaveBeenCalledWith(expect.objectContaining({
            url: 'http://example.com/stream/parsed',
            dir: 'movies',
        }))
        expect(autoParser).toHaveBeenCalled()
    })

    it('lists missions via GET /list', async () => {
        DownloadService.queryByPage.mockResolvedValueOnce({
            count: 1,
            rows: [{ uid: '1', name: 'mission' }],
            total: 1,
        })

        const res = await agent.get('/list').query({
            current: 1,
            pageSize: 10,
            status: '1',
        })

        expect(res.status).toBe(200)
        expect(res.body.code).toBe(0)
        expect(DownloadService.queryByPage).toHaveBeenCalledWith(expect.objectContaining({
            pageNumber: '1',
            pageSize: '10',
            status: '1',
        }))
    })

    it('pauses missions via GET /pause', async () => {
        const missionUid = 'mission-1'
        await agent.post('/down').send({
            name: 'video',
            url: 'http://example.com/stream',
            dir: 'movies',
        })
        const res = await agent.get('/pause').query({ uid: missionUid })
        expect(res.status).toBe(200)
        expect(oimi.pauseMission).toHaveBeenCalledWith(missionUid)
    })

    it('resumes missions via GET /resume', async () => {
        const missionUid = 'mission-1'
        await agent.post('/down').send({
            name: 'video',
            url: 'http://example.com/stream',
            dir: 'movies',
        })
        const res = await agent.get('/resume').query({ uid: missionUid })
        expect(res.status).toBe(200)
        expect(oimi.resumeDownload).toHaveBeenCalledWith(missionUid)
    })

    it('deletes missions via DELETE /del', async () => {
        const res = await agent.delete('/del').query({ uid: 'mission-1' })
        expect(res.status).toBe(200)
        expect(oimi.deleteDownload).toHaveBeenCalledWith('mission-1')
    })

    it('stops missions via POST /stop', async () => {
        const missionUid = 'mission-1'
        await agent.post('/down').send({
            name: 'video',
            url: 'http://example.com/stream',
            dir: 'movies',
        })
        const res = await agent.post('/stop').query({ uid: missionUid })
        expect(res.status).toBe(200)
        expect(oimi.stopDownload).toHaveBeenCalledWith(missionUid)
    })

    it('streams mission list via GET /list/sse', async () => {
        const router = createDownloadRouter(oimi)
        const sseLayer = router.stack.find(layer => layer.route?.path === '/list/sse')
        const handler = sseLayer.route.stack[sseLayer.route.stack.length - 1].handle

        const req = new EventEmitter()
        req.query = { current: '1', pageSize: '10', status: '1' }
        req.headers = {}
        const res = new EventEmitter()
        res.setHeader = jest.fn()
        res.flushHeaders = jest.fn()
        res.write = jest.fn()
        res.end = jest.fn()

        const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((fn) => {
            fn()
            return 'interval-id'
        })
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {})

        await handler(req, res)
        await Promise.resolve()

        expect(res.write).toHaveBeenCalledWith(expect.stringContaining('data:'))
        req.emit('close')
        expect(clearIntervalSpy).toHaveBeenCalledWith('interval-id')

        intervalSpy.mockRestore()
        clearIntervalSpy.mockRestore()
    })
})

describe('System Router', () => {
    let app
    let server
    let agent
    let oimi

    beforeEach(() => {
        oimi = createOimiStub()
        ;({ app, server, agent } = setupTestServer('/sys', createSystemRouter(oimi)))
    })

    afterEach(() => {
        server?.close()
        jest.clearAllMocks()
    })

    it('returns config via GET /sys/config', async () => {
        const res = await agent.get('/sys/config')
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual(oimi.config)
    })

    it('updates config via POST /sys/config', async () => {
        const payload = { port: 9000, downloadDir: '/media' }
        const res = await agent.post('/sys/config').send(payload)
        expect(res.status).toBe(200)
        expect(Utils.modifyYml).toHaveBeenCalledWith(payload)
        expect(oimi.config).toEqual(payload)
    })

    it('reads version info via GET /sys/version', async () => {
        const res = await agent.get('/sys/version')
        expect(res.status).toBe(200)
        expect(Utils.getFrontEndVersion).toHaveBeenCalled()
        expect(res.body.code).toBe(0)
    })

    it('triggers frontend upgrade via GET /sys/upgrade', async () => {
        const res = await agent.get('/sys/upgrade')
        expect(res.status).toBe(200)
        expect(Utils.autoUpdateFrontEnd).toHaveBeenCalled()
    })

    it('lists directories via GET /sys/dir', async () => {
        const res = await agent.get('/sys/dir')
        expect(res.status).toBe(200)
        expect(res.body.code).toBe(0)
        expect(res.body.data[0]).toHaveProperty('label')
    })

    it('sends webhook test via GET /sys/testWebhook', async () => {
        const res = await agent.get('/sys/testWebhook').query({
            webhooks: 'http://hook.local',
            webhookType: 'gotify',
        })
        expect(res.status).toBe(200)
        expect(Utils.msg).toHaveBeenCalled()
    })
})

describe('User Router', () => {
    let app
    let server
    let agent

    beforeEach(() => {
        ;({ app, server, agent } = setupTestServer('/user', createUserRouter(), { withSessionUser: false }))
    })

    afterEach(() => {
        server?.close()
        jest.clearAllMocks()
    })

    it('registers a new user', async () => {
        UserService.queryByUsername.mockResolvedValueOnce(null)
        UserService.create.mockResolvedValueOnce({ uid: 'u1' })

        const res = await agent.post('/user/register').send({
            username: 'tester',
            password: 'secret',
        })

        expect(res.status).toBe(200)
        expect(UserService.create).toHaveBeenCalled()
        expect(res.body.code).toBe(0)
    })

    it('logs in when no users exist', async () => {
        UserService.count.mockResolvedValueOnce(0)
        UserService.create.mockResolvedValueOnce({ uid: 'u1' })

        const res = await agent.post('/user/login').send({
            username: 'first',
            password: 'secret',
        })

        expect(res.status).toBe(200)
        expect(UserService.create).toHaveBeenCalled()
        expect(res.body.code).toBe(0)
    })

    it('logs in existing user', async () => {
        const hashed = await bcrypt.hash('secret', 10)
        UserService.count.mockResolvedValueOnce(1)
        UserService.queryByUsername.mockResolvedValueOnce({ username: 'tester', password: hashed })

        const res = await agent.post('/user/login').send({
            username: 'tester',
            password: 'secret',
        })

        expect(res.status).toBe(200)
        expect(res.body.code).toBe(0)
    })

    it('logs out via GET /user/logout', async () => {
        const authAgent = request.agent(server)
        await authAgent.post('/user/login').send({ username: 'tester', password: 'secret' })
        const res = await authAgent.get('/user/logout')
        expect(res.status).toBe(200)
        expect(res.body.code).toBe(0)
    })

    it('resets password via POST /user/resetPassword', async () => {
        const hashed = await bcrypt.hash('old', 10)
        UserService.queryByUsername.mockResolvedValueOnce({ username: 'tester', password: hashed })

        const res = await agent.post('/user/resetPassword').send({
            username: 'tester',
            password: 'newPass',
            currentPassword: 'old',
        })

        expect(res.status).toBe(200)
        expect(UserService.update).toHaveBeenCalled()
    })
})

describe('Plugin Router', () => {
    let app
    let server
    let agent

    beforeEach(() => {
        ;({ app, server, agent } = setupTestServer('/plugin', createPluginRouter()))
        jest.spyOn(fse, 'removeSync').mockImplementation(() => {})
        jest.spyOn(fse, 'pathExistsSync').mockReturnValue(true)
    })

    afterEach(() => {
        server?.close()
        jest.restoreAllMocks()
        jest.clearAllMocks()
    })

    it('lists plugins via GET /plugin/list', async () => {
        const res = await agent.get('/plugin/list').query({
            current: 1,
            pageSize: 10,
        })

        expect(res.status).toBe(200)
        expect(PluginService.queryByPage).toHaveBeenCalled()
    })

    it('creates plugin via POST /plugin/create', async () => {
        const res = await agent.post('/plugin/create').send({
            url: 'http://plugin.local/mock.js',
        })

        expect(res.status).toBe(200)
        expect(getPlugin).toHaveBeenCalled()
    })

    it('deletes plugin via GET /plugin/delete', async () => {
        const res = await agent.get('/plugin/delete').query({ uid: 'p1' })
        expect(res.status).toBe(200)
        expect(PluginService.delete).toHaveBeenCalledWith('p1')
    })

    it('batch deletes plugins via GET /plugin/batchDelete', async () => {
        const res = await agent.get('/plugin/batchDelete').query({ uids: 'p1,p2' })
        expect(res.status).toBe(200)
        expect(PluginService.batchDelete).toHaveBeenCalled()
    })

    it('updates plugin status via POST /plugin/batchStatus', async () => {
        const res = await agent.post('/plugin/batchStatus').send({
            uids: 'p1,p2',
            status: '0',
        })

        expect(res.status).toBe(200)
        expect(PluginService.batchStatus).toHaveBeenCalled()
        expect(fse.removeSync).toHaveBeenCalled()
    })

    it('downloads plugin when enabling missing local file', async () => {
        fse.pathExistsSync.mockReturnValue(false)
        const res = await agent.post('/plugin/batchStatus').send({
            uids: 'p1',
            status: '1',
        })
        expect(res.status).toBe(200)
        expect(getPlugin).toHaveBeenCalledWith('http://plugin.local/mock.js', '/tmp/plugin.js')
    })

    it('updates plugin options via POST /plugin/options', async () => {
        const res = await agent.post('/plugin/options').send({
            uid: 'p1',
            options: '{}',
        })
        expect(res.status).toBe(200)
        expect(PluginService.update).toHaveBeenCalled()
    })
})

describe('checkAuth middleware', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('allows public routes', async () => {
        const next = jest.fn()
        const req = { path: '/user/login', session: {} }
        const res = {}
        await checkAuth(req, res, next)
        expect(next).toHaveBeenCalled()
    })

    it('allows requests with session user', async () => {
        const next = jest.fn()
        const req = { path: '/secure', session: { user: { username: 'tester' } } }
        const res = {}
        await checkAuth(req, res, next)
        expect(next).toHaveBeenCalled()
    })

    it('validates username/password pair', async () => {
        const hashed = await bcrypt.hash('secret', 10)
        UserService.queryByUsername.mockResolvedValueOnce({ username: 'tester', password: hashed })

        const next = jest.fn()
        const req = {
            path: '/secure',
            session: {},
            body: { username: 'tester', password: 'secret' },
        }
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        }
        await checkAuth(req, res, next)
        expect(next).toHaveBeenCalled()
    })

    it('rejects invalid credentials', async () => {
        UserService.queryByUsername.mockResolvedValueOnce(null)

        const next = jest.fn()
        const req = {
            path: '/secure',
            session: {},
            query: { username: 'tester', password: 'bad' },
        }
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        }
        await checkAuth(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
        expect(next).not.toHaveBeenCalled()
    })
})

describe('requestLogger middleware', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('logs request lifecycle', () => {
        const req = {
            method: 'GET',
            originalUrl: '/api/download',
            path: '/api/download',
        }
        const res = new EventEmitter()
        res.statusCode = 200
        res.on = res.addListener
        const next = jest.fn()

        requestLogger(req, res, next)
        res.emit('finish')
        expect(Utils.LOG.info).toHaveBeenCalled()
        expect(next).toHaveBeenCalled()
    })
})
