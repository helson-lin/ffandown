const { SysPluginsDb } = require('./entity')
const { Op } = require('sequelize')
// 测试的地址： https://file.helson-lin.cn/picgo/bi.js
const PluginService = {
    // 新增插件
    async create (body) {
        try {
            const time = new Date().toISOString()
            const pluginDto = await SysPluginsDb.create({ ...body, crt_tm: time, upd_tm: time })
            return Promise.resolve(pluginDto)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    // 批量删除插件
    async batchDelete (uids) {
        if (!uids || uids.length === 0) {
            return Promise.reject('uid is required')
        } else {
            try {
                const pluginDtos = await SysPluginsDb.findAll({ where: { uid: { [Op.in]: uids } } })
                if (!pluginDtos || pluginDtos.length === 0) return Promise.reject('not found any data')
                await SysPluginsDb.destroy({ where: { uid: { [Op.in]: uids } } })
                return Promise.resolve(pluginDtos)
            }  catch (e) {
                return Promise.reject(e)
            }
        }
    },
    // 删除插件
    async delete(uid) {
        if (!uid) {
            return Promise.reject('uid is required')
        } else {
            try {
                // 删除插件 raw: true 查询元数据
                const pluginDto = await SysPluginsDb.findOne({ where: { uid }, raw: true })
                if (!pluginDto) return Promise.reject('not found any data')
                await SysPluginsDb.destroy({ where: { uid } })
                return Promise.resolve(pluginDto)
            }  catch (e) {
                return Promise.reject(e)
            }
        }
    },
    // 更新插件
    async update (data) {
        try {
            const { uid } = data
            if (!uid) {
                return Promise.reject('uid is required')
            } else {
                const pluginDto = await SysPluginsDb.findOne({ where: { uid }, raw: true })
                if (!pluginDto) return Promise.reject('not found any data')
                const time = new Date().toISOString()
                await SysPluginsDb.update({ ...data, upd_tm: time }, { where: { uid } })
                return Promise.resolve(pluginDto)
            }
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async batchStatus (uids, status) {
        try {
            if (!uids || uids.length === 0) {
                return Promise.reject('uid is required')
            } else {
                console.warn(uids, status)
                const pluginDtos = await SysPluginsDb.findAll({ where: { uid: { [Op.in]: uids } } })
                if (!pluginDtos || pluginDtos.length === 0) return Promise.reject('not found any data')
                const time = new Date().toISOString()
                await SysPluginsDb.update({ status, upd_tm: time }, { where: { uid: { [Op.in]: uids } } })
                return Promise.resolve(pluginDtos)
            }
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async getAll () {
        try {
            const pluginDtos = await SysPluginsDb.findAll({ where: { status: '1' }, raw: true })
            return Promise.resolve(pluginDtos)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async queryByPage ({ pageNumber = 1, pageSize = 1, sortField = 'crt_tm', sortOrder = 'DESC', status = '1,0' }) {
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
            const { count, rows } = await SysPluginsDb.findAndCountAll(options)
            const total = Math.ceil(count / pageSize) // 计算总页数
            return {
                count,
                rows,
                total,
            }
        } catch (e) {
            return Promise.reject(e)
        }
    },
}


module.exports = PluginService