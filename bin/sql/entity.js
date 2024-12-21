const Sequelize = require('sequelize')
const sqlite3 = require('sqlite3')
const path = require('path')
const dbFile = path.join(process.cwd(), '/database/sqlite.db')

const sequelize = new Sequelize('database', null, null, {
    dialect: 'sqlite',
    storage: dbFile,
    define: {
        timestamps: false,
        freezeTableName: true,
    },
    logging: false,
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
    useragent: {
        type: Sequelize.STRING,
        allowNull: true,
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
    size: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    preset: {
        type: Sequelize.STRING,
        allowNull: true,
        default: 'medium',
        comment: 'ffmpeg tranform preset',
    },
    outputformat: {
        type: Sequelize.STRING,
        allowNull: true,
        default: 'mp4',
        comment: 'ffmpeg output format',
    },
    protocolType: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'url protocol type',
    },
    status: {
        type: Sequelize.STRING,
        allowNull: false,
        default: '0',
        comment: '0/initial status; 1/ downloading status; 2/stopped status; 3/ finish status;/ 4 error happed,5 waiting download',
    },
    message: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    crt_tm: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    upd_tm: {
        type: Sequelize.STRING,
        allowNull: false,
    },
})

module.exports = { SysDownloadDb, sequelize }