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
    uid: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
    },
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
    filePath: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    speed: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    timemark: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'timemark',
    },
    status: {
        type: Sequelize.STRING,
        allowNull: false,
        default: '0',
        comment: '0/initial status; 1/ downlaoding status; 2/stopped status; 3/ finish status;',
    },
})

const sync = async () => {
    await sequelize.sync()
    console.log('Database synced successfully')
}

const SysDownload = {
    /**
     * @description create download record
     * @param {*} param {uid, name, url, percent, filePath, status, speed} 
     * @returns 
     */
    async create (body) {
        try {
            const download = await SysDownloadDb.create({ ...body })
            return Promise.resolve(download)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async update (uid, { percent, speed, targetSize, timemark }) {
        try {
            const download = await SysDownloadDb.update({ percent, speed, targetSize, timemark }, { where: { uid } })
            return Promise.resolve(download)
        } catch (e) {
            console.log('update failed', e)
            return Promise.reject(e)
        }
    },
    async delete (uid) {
        try {
            const deletedRes = await SysDownloadDb.destroy({ where: { uid } })
            console.log(deletedRes)
            return Promise.resolve(deletedRes)
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