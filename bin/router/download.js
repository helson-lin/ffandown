const express = require('express')
const i18n = require('../utils/locale')
const bodyParser = require('body-parser')
const Utils = require('../utils/index')
const jsonParser = bodyParser.json()
const downloadRouter = express.Router()
const DownloadService = require('../sql/downloadService')

/**
 * @description create download router
 * @returns 
 */
function createDownloadRouter (oimi) {
    // create download mission
    downloadRouter.post('/down', jsonParser, (req, res) => {
        let { name, url, preset, outputformat, useragent, dir, enableTimeSuffix } = req.body
        // if the config option have preset and outputformat, and body have't will auto replace
        if (!preset && oimi.config?.preset) preset = oimi.config.preset
        if (!outputformat && oimi.config.outputformat) outputformat = oimi.config.outputformat
        url = Utils.getRealUrl(url)
        if (!url) {
            res.send({ code: 1, message: i18n._('query_error') })
        } else {
            try {
                const isMultiple = Array.isArray(url)
                // 如果url是逗号分隔的多个链接处理
                if (isMultiple) {
                    for (const urlItem of url) {
                        oimi.createDownloadMission({ 
                            url: urlItem, 
                            dir, 
                            preset, 
                            enableTimeSuffix, 
                            useragent, 
                            outputformat,
                        }).then(() => {
                            Utils.LOG.info(`${i18n._('create_success')}:` + urlItem)
                        }).catch((e) => {
                            Utils.LOG.error(`${i18n._('create_failed')}:` + e)
                        })
                    }
                } else {
                    oimi.createDownloadMission({ 
                        name, 
                        url,
                        dir,
                        preset,
                        enableTimeSuffix,
                        useragent,
                        outputformat, 
                    }).then(() => {
                        Utils.LOG.info(`${i18n._('create_success')}:` + url)
                    }).catch((e) => {
                        Utils.LOG.error(`${i18n._('create_failed')}:` + e)
                    })
                }
                res.send({ code: 0, message: `${url}: ${i18n._('create_success')}` })
            } catch (e) {
                res.send({ code: 1, message: String(e) })
            }
        }
    })
    // get download list
    downloadRouter.get('/list', async (req, res) => {
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
    downloadRouter.get('/pause', async (req, res) => {
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
    downloadRouter.get('/resume', async (req, res) => {
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
    downloadRouter.delete('/del', async (req, res) => {
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
    downloadRouter.post('/stop', async (req, res) => {
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