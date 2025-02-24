const express = require('express')
const bodyParser = require('body-parser')
const i18n = require('../utils/locale')
const Utils = require('../utils/index')
const path = require('path')
const validate = require('../middleware/validate')
const { query } = require('express-validator')
const jsonParser = bodyParser.json()
const systemRouter = express.Router()

function createSystemRouter (oimi) {
    // 子路由
    systemRouter.get('/config', async (req, res) => {
        res.send({ code: 0, data: oimi.config })
    })

    systemRouter.post('/config', jsonParser, async (req, res) => {
        const data = req.body
        data.port = Number(data.port)
        Utils.modifyYml(data)
        // sync data to config on instance
        oimi.config = data
        res.send({ code: 0, message: i18n._('update_success') })
    })

    // get version info
    systemRouter.get('/version', async (req, res) => {
        try {
            const version = await Utils.getFrontEndVersion()
            res.send({ code: 0, data: version })
        } catch (e) {
            res.send({ code: 1, message: e.message })
        }
    })

    // upgrade front end
    systemRouter.get('/upgrade', async (req, res) => {
        try {
            await Utils.autoUpdateFrontEnd()
            res.send({ code: 0, message: i18n._('upgrade_success')  })
        } catch (e) {
            res.send({ code: 1, message: e.message })
        }
    })

    systemRouter.get('/dir', async (req, res) => {
        try {
            const dirs = await Utils.getDirectories(
                path.join(process.cwd(), oimi.config.downloadDir), 
                oimi.config.downloadDir,
            )
            dirs.unshift({
                label: '/media/',
                value: '/media/',

            })
            res.send({ code: 0, data: dirs })
        } catch (e) {
            Utils.LOG.error(e)
            res.send({ code: 1, message: i18n._('system_error') })
        }
    })

    systemRouter.get('/testWebhook', validate([
        query('webhooks').isString().notEmpty().withMessage('webhooks is required'),
        query('webhookType').isString().notEmpty().withMessage('webhookType is required'),
    ]), async (req, res) => {
        const { webhookType, webhooks } = req.query
        try {
            Utils.msg(webhooks, webhookType, i18n._('msg_title'), i18n._('test_notification'))
            .then(() => {
                res.send({ code: 0, message: i18n._('send_success') })
            })
            .catch(e => {
                res.send({ code: 1, message: e })
            })
        } catch (e) {
            res.send({ code: 1, message: e })
        }
    })
    return systemRouter
}

module.exports = createSystemRouter
