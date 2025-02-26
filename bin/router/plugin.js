const express = require('express')
const fse = require('fs-extra')
const i18n = require('../utils/locale')
const { getPlugin } = require('../utils/parser')
const validate = require('../middleware/validate')
const { query, body } = require('express-validator')
const { v4: uuidv4 } = require('uuid')
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()
const PluginService = require('../sql/pluginService')
const pluginRouter = express.Router()

/**
 * @description 创建插件路由
 * @returns 
 */
function createPluginRouter() {
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
            await PluginService.create({
                uid: uuidv4(),
                name: data.name || pluginInfo?.name, 
                url: pluginInfo.url, 
                author: pluginInfo?.author || '',
                description: pluginInfo.description || '',
                localUrl: pluginInfo?.localUrl || '',
                status: '1',
            })
            res.send({ code: 0, data: pluginInfo })
        } catch (e) {
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
    // 修改插件信息
    return pluginRouter
}


module.exports = createPluginRouter