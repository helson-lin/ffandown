const { sequelize, SysDownloadDb } = require('./entity')
const UserService = require('./userService')
const DownloadService = require('./downloadService')
const dbOperation = {
    async sync () {
        try {
            await sequelize.sync({ alter: true })
            // 手动处理用户数据
            await SysDownloadDb.update({ preset: 'medium', outputformat: 'mp4' }, { where: { preset: null } })
            console.log('\x1b[32m[ffandown] Database synced successfully\x1b[0m')
        } catch (e) {
            console.log('\x1b[31m[ffandown] Database synced failed:' + String(e).trim() + '\x1b[0m')
        }
    },
    DownloadService,
    UserService,
}

module.exports = dbOperation