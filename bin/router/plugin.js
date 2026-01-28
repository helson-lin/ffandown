const express = require('express')
const fse = require('fs-extra')
const i18n = require('../utils/locale')
const { getPlugin } = require('../utils/parser')
const validate = require('../middleware/validate')
const { query, body } = require('express-validator')
const { v4: uuidv4 } = require('uuid')
const bodyParser = require('body-parser')
const log = require('../utils/log')
const jsonParser = bodyParser.json()
const PluginService = require('../sql/pluginService')

/**
 * @description 创建插件路由
 * @returns 
 */
function createPluginRouter() {
    const pluginRouter = express.Router()
    // 查询插件列表
    pluginRouter.get('/list', validate([
        query('current').isInt().notEmpty().withMessage('current is required'),
        query('pageSize').isInt().notEmpty().withMessage('pageSize is required'),
        query('status').isString().optional(),
    ]), async (req, res) => {
        const { current, pageSize, status } = req.query
        try {
            const data = {
                pageNumber: current, pageSize, status,
            }
            if (req.query?.sortField) data['sortField'] = req.query.sortField
            if (req.query?.sortOrder) data['sortOrder'] = req.query.sortOrder
            const list = await PluginService.queryByPage(data)
            res.send({
                code: 0,
                data: list,
            })
        } catch (e) {
            res.send({
                code: 1,
                message: String(e),
            })
        }
        // }
    })
    // 新增插件
    pluginRouter.post('/create',[jsonParser, validate([
        body('name').isString().optional(),
        body('url').isString().notEmpty().withMessage('url is required'),
    ])], async (req, res) => {
        const data = req.body
        // const { url } = req.body
        try {
            const pluginInfo = await getPlugin(data.url)
            // 存储数据到数据库内
            log.verbose(JSON.stringify(pluginInfo, null, 2))
            await PluginService.create({
                uid: uuidv4(),
                name: data.name || pluginInfo?.name, 
                url: pluginInfo.url, 
                author: pluginInfo?.author || '',
                description: pluginInfo.description || '',
                localUrl: pluginInfo?.localUrl || '',
                version: pluginInfo?.version || '',
                icon: pluginInfo?.icon || '',
                homepage: pluginInfo?.homepage || '',
                settings: pluginInfo?.settings || '',
                status: '1',
            })
            res.send({ code: 0, data: pluginInfo })
        } catch (e) {
            log.error(e)
            res.send({ code: 1, message: String(e) })
        }
    })
    // 删除插件
    pluginRouter.get('/delete', validate([
        query('uid').isString().notEmpty().withMessage('uid is required'),
    ]), async (req, res) => {
        try {
            const deletedPlugin = await PluginService.delete(req.query?.uid)
            if (deletedPlugin) {
                // 通过deletedPlugin.localUrl 删除文件
                fse.removeSync(deletedPlugin.localUrl)
            }
            res.send({ code: 0, data: !deletedPlugin ? i18n._('query_error') : i18n._('delete_success') })
        } catch (e) {
            res.send({ code: 1, message: String(e) })
        }
    })
    // 批量删除插件
    pluginRouter.get('/batchDelete', validate([
        query('uids').isString().notEmpty().withMessage('uids is required'),
    ]), async (req, res) => {
        try {
            const uids = req.query?.uids?.split(',')
            const deletedPlugins = await PluginService.batchDelete(uids)
            if (deletedPlugins) {
                // 通过deletedPlugin.localUrl 删除文件
                deletedPlugins.forEach(plugin => {
                    fse.removeSync(plugin.localUrl)
                })
            }
            res.send({ code: 0, data:!deletedPlugins? i18n._('query_error') : i18n._('delete_success') })
        } catch (e) {
            res.send({ code: 1, message: String(e) })
        }
    })
    // 修改插件
    pluginRouter.post('/batchStatus', [jsonParser, validate([
        body('uids').isString().notEmpty().withMessage('uids is required'),
        body('status').isString().notEmpty().withMessage('status is required'),
    ])], async (req, res) => {
        try {
            const { uids, status } = req.body
            // uids 是字符串，需要转换为数组
            let uidsArray
            try {
                uidsArray = uids.split(',')
            } catch {
                throw new Error('uids is an illegal string')
            }
            const plugins = await PluginService.batchStatus(uidsArray,  status)
            if (status === '0') {
                // 更新状态完毕之后，如果状态是禁用，直接删除本地的插件。
                plugins.forEach(plugin =>  fse.removeSync(plugin.localUrl))
            } else {
                // 如果状态为启用，并且本地没有改插件，那么下载插件。
                plugins.forEach(plugin => {
                    // 1. 判断文件是否存在
                    const isExist = fse.pathExistsSync(plugin.localUrl)
                    // 2. 不存在，下载插件
                    if (!isExist) getPlugin(plugin.url, plugin.localUrl)
                })
            }
            res.send({ code: 0, data: plugins })
        } catch (e) {
            res.send({ code: 1, message: String(e) })
        }
    })
    // 存储插件设置数据
    pluginRouter.post('/options',[jsonParser, validate([
        body('uid').isString().notEmpty().withMessage('uid is required'),
        body('options').isString().notEmpty().withMessage('settings is required'),
    ])], async (req, res) => {
        try {
            const { uid, options } = req.body
            const plugin = await PluginService.update({ uid, options })
            res.send({ code: 0, data: plugin })
        } catch (e) {
            res.send({ code: 1, message: String(e) })
        }
    })
    return pluginRouter
}


module.exports = createPluginRouter
