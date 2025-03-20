const express = require('express')
const i18n = require('../utils/locale')
const { autoParser } = require('../utils/parser')
const bodyParser = require('body-parser')
const Utils = require('../utils/index')
const validate = require('../middleware/validate')
const jsonParser = bodyParser.json()
const downloadRouter = express.Router()
const DownloadService = require('../sql/downloadService')
const { query, body } = require('express-validator')

async function createDonwloadMission (oimi, options) {
    const parsedData = await autoParser(options.url)
    if (!parsedData || !parsedData?.url) {
        Utils.LOG.error('parser url error:' + options.url)
    } else {
        const data = Object.assign(options, { url: parsedData.url  })
        // 创建下载任务
        oimi.createDownloadMission(data).then(() => {
            Utils.LOG.info(`${i18n._('create_success')}:` + options.url)
        }).catch((e) => {
            Utils.LOG.error(`${i18n._('create_failed')}:` + e)
        })
    }
}

/**
 * @description create download router
 * @returns 
 */
function createDownloadRouter (oimi) {
    // create download mission
    downloadRouter.post('/down', [jsonParser, validate([
        body('name').optional().isString(),
        body('url').notEmpty().withMessage('url must be a valid URL'),
        body('audioUrl').optional().isString().withMessage('audioUrl must be a valid URL'),
        body('preset').optional().isString().withMessage('preset must be a string'),
        body('outputformat').optional().isString().withMessage('outputformat must be a string'),
        body('useragent').optional().isString().withMessage('useragent must be a string'),
        body('enableTimeSuffix').optional().isBoolean().withMessage('enableTimeSuffix must be a boolean'),
        body('headers').optional().isArray().withMessage('headers must be an array'),
    ])], async (req, res) => {
        let { name, url, preset, outputformat, useragent, dir, audioUrl, enableTimeSuffix, headers } = req.body
        // if the config option have preset and outputformat, and body have't will auto replace
        // 如果没有 preset/outputformat那么采用配置文件
        if (!preset && oimi.config?.preset) preset = oimi.config.preset
        if (!outputformat && oimi.config.outputformat) outputformat = oimi.config.outputformat
        // url 可能为多链接，这里进行处理
        url = Utils.getRealUrl(url)
        if (!url) {
            res.send({ code: 1, message: i18n._('query_error') })
        } else {
            try {
                if (Array.isArray(url)) {
                    for (const urlItem of url) {
                        createDonwloadMission(oimi, {
                            url: urlItem, 
                            dir, 
                            audioUrl,
                            preset, 
                            enableTimeSuffix, 
                            useragent, 
                            outputformat,
                            headers,
                        })
                    }
                } else {
                    // todo: 解析地址,返回的数据格式为{url, audioUrl}
                    createDonwloadMission(oimi, {
                        url,
                        name, 
                        dir,
                        preset,
                        audioUrl,
                        enableTimeSuffix,
                        useragent,
                        outputformat, 
                        headers,
                    })
                }
                res.send({ code: 0, message: `${url}: ${i18n._('create_success')}` })
            } catch (e) {
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // get download list
    downloadRouter.get('/list', validate([
        query('current').notEmpty().withMessage('current is required'),
        query('pageSize').notEmpty().withMessage('pageSize is required'),
        query('status').notEmpty().isString().withMessage('status is required'),
        query('order').optional().isString(),
        query('sort').optional().isString(),
    ]), async (req, res) => {
        const { current, pageSize, status, order, sort } = req.query
        try {
            const list =  await DownloadService.queryByPage({
                pageNumber: current, 
                pageSize, 
                status, 
                sortField: sort || 'crt_tm', 
                sortOrder: order || 'DESC',
            })
            res.send({ code: 0, data: list })
        } catch (e) {
            Utils.LOG.error(e)
            res.send({ code: 1, message: String(e) })
        }
    })
    // pause download
    downloadRouter.get('/pause', validate([
        query('uid').notEmpty().withMessage('uid is required'),
    ]), async (req, res) => {
        const { uid } = req.query
        if (!uid) {
            res.send({ code: 0, message: i18n._('query_error') })
        } else {
            try {
                await oimi.pauseMission(uid)
                res.send({ code: 0 })
            } catch (e) {
                Utils.LOG.error(e)
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // pause download
    downloadRouter.get('/resume', validate([
        query('uid').notEmpty().isString().withMessage('uid is required'),
    ]), async (req, res) => {
        const { uid } = req.query
        if (!uid) {
            res.send({ code: 0, message: i18n._('query_error') })
        } else {
            try {
                await oimi.resumeDownload(uid)
                res.send({ code: 0 })
            } catch (e) {
                Utils.LOG.error(e)
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // delete mission
    downloadRouter.delete('/del', validate([
        query('uid').notEmpty().isString().withMessage('uid is required'),
    ]), async (req, res) => {
        let uid = req.query?.uid
        if (uid && uid.indexOf(',')) {
            uid = uid.split(',')
        }
        if (!uid || uid === undefined) {
            res.send({ code: 1, message: i18n._('uid_required') })
        } else {
            try {
                await oimi.deleteDownload(uid)
                res.send({ code: 0, message: i18n._('delete_success') })
            } catch (e) {
                Utils.LOG.error(e)
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // stop mission
    downloadRouter.post('/stop', validate([
        query('uid').notEmpty().isString().withMessage('uid is required'),
    ]), async (req, res) => {
        const uid = req.query?.uid
        if (!uid || uid === undefined) {
            res.send({ code: 1, message: i18n._('uid_required') })
        } else {
            try {
                await oimi.stopDownload(uid)
                res.send({ code: 0, message: i18n._('stop_success') })
            } catch (e) {
                Utils.LOG.error(e)
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    return downloadRouter
}

module.exports = createDownloadRouter