const { SysPluginsDb } = require('./entity')

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
}


module.exports = PluginService