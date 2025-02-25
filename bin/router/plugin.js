const express = require('express')
const { getPlugin } = require('../utils/parser')
const validate = require('../middleware/validate')
const { query, body } = require('express-validator')
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
        body('name').isString().notEmpty().withMessage('name is required'),
        body('url').isString().notEmpty().withMessage('url is required'),
    ])], async (req, res) => {
        const { name, url } = req.body
        try {
            await getPlugin(url)
            res.send({ code: 0 })
        } catch (e) {
            res.send({ code: 1, message: String(e) })
        }
    })
    return pluginRouter
}


module.exports = createPluginRouter