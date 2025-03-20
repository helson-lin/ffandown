const colors = require('colors')
const { sequelize, SysDownloadDb } = require('./entity')
const dbOperation = {
    async sync () {
        try {
            await sequelize.sync({ alter: true })
            // 手动处理用户数据
            await SysDownloadDb.update({ preset: 'medium', outputformat: 'mp4' }, { where: { preset: null } })
            console.log(colors.blue('Database synchronization successful'))
        } catch (e) {
            console.log(colors.red('Database synchronization failed:' + String(e).trim()))
        }
    },
}

module.exports = dbOperation