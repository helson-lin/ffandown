const Sequelize = require('sequelize')
const sqlite3 = require('sqlite3')
const path = require('path')
const dbFile = path.join(process.cwd(), '/db/sqlite.db')
const sequelize = new Sequelize('database', null, null, {
    dialect: 'sqlite',
    storage: dbFile,
    define: {
        timestamps: false,
        freezeTableName: true,
    },
    dialectModule: sqlite3,
})

const SysDownloadDb = sequelize.define('sys_download', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    url: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    percent: {
        type: Sequelize.STRING,
        allowNull: true,
    },
})

const sync = async () => {
    await sequelize.sync()
    console.log('Database synced successfully')
}

const SysDownload = {
    async create (name, url, percent) {
        try {
            const downlaod = await SysDownloadDb.create({ name, url, percent })
            return Promise.resolve(downlaod)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async getAll () {
        try {
            const all = await SysDownloadDb.findAll()
            return Promise.resolve(all)
        } catch (e) {
            return Promise.reject(e)
        }
    },
}

module.exports = { SysDownload, sync }