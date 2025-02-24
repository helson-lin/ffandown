const { SysPluginsDb } = require('./entity')
const { Op } = require('sequelize')
// 测试的地址： https://file.helson-lin.cn/picgo/bi.js
const PluginService = {
    // 新增插件
    async create (body) {
        try {
            const time = new Date().toLocaleString()
            const userDto = await SysPluginsDb.create({ ...body, crt_tm: time, upd_tm: time })
            return Promise.resolve(userDto)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async delete(uid) {
        if (!uid) {
            return Promise.reject('uid is required')
        } else {
            try {
                // 删除插件
                const pluginDto = await SysPluginsDb.destroy({ where: { uid } })
                return Promise.resolve(pluginDto)
            }  catch (e) {
                return Promise.reject(e)
            }
        }
    },
    async queryByPage ({ pageNumber = 1, pageSize = 1, sortField = 'crt_tm', sortOrder = 'ASC', status = '1' }) {
        try {
            const statusList = String(status || '1').split(',').map(item => Number(item.trim()))
            const offset = (pageNumber - 1) * pageSize
            const options = {
                limit: pageSize,
                offset,
                order: [[sortField, sortOrder]],
                where: { 
                    status: { [Op.in]: statusList },
                },
            }
            return await SysPluginsDb.findAndCountAll(options)
        } catch (e) {
            return Promise.reject(e)
        }
    },
}


module.exports = PluginService