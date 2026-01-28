const Sequelize = require('sequelize')
const sqlite3 = require('sqlite3')
const path = require('path')
const { DATABASE } = require('../utils/constants')

const dbFile = path.join(process.cwd(), '/database/sqlite.db')

const sequelize = new Sequelize('database', null, null, {
    dialect: 'sqlite',
    storage: dbFile,

    // Optimized connection pool configuration 优化的连接池配置
    pool: {
        // Maximum number of connections in pool
        max: DATABASE.POOL.max,

        // Minimum number of connections in pool
        min: DATABASE.POOL.min,

        // Maximum time (ms) to acquire a connection before throwing error
        acquire: DATABASE.POOL.acquire,

        // Maximum time (ms) a connection can be idle before being released
        idle: DATABASE.POOL.idle,

        // Maximum time (ms) that a connection can be idle before being evicted
        evict: DATABASE.POOL.evict,

        // Connection retry configuration
        retry: DATABASE.POOL.retry,
    },

    // Database timeout configurations
    retry: {
        match: [/SQLITE_BUSY/],
        max: DATABASE.POOL.retry.max,
    },

    define: {
        timestamps: false,
        freezeTableName: true,
    },

    logging: false,

    dialectModule: sqlite3,

    // Additional optimization settings
    // Disable tracking of database changes (better performance)
    omitNull: true,

    // Native binding is not available for SQLite
    native: false,
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
    audioUrl: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    useragent: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    percent: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    dir: {
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
    onlyTranscode: {
        type: Sequelize.STRING,
        allowNull: true,
        default: '0',
        comment: 'only transcode 0/no 1/yes',
    },
    status: {
        type: Sequelize.STRING,
        allowNull: false,
        default: '0',
        comment: `
        0/initial status 1/ downloading status; 2/stopped status; 3/ finish status;/ 4 error happed,5 waiting download`,
    },
    message: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    crt_tm: {
        type: Sequelize.DATE,
        allowNull: false,
        default: Sequelize.NOW,
    },
    upd_tm: {
        type: Sequelize.DATE,
        allowNull: false,
        default: Sequelize.NOW,
    },
})

const SysUsersDb = sequelize.define('sys_users', {
    uid: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    role: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    on: {
        type: Sequelize.STRING,
        allowNull: false,
        default: '1',
    },
    crt_tm: {
        type: Sequelize.DATE,
        default: Sequelize.NOW,
        allowNull: false,
    },
    upd_tm: {
        type: Sequelize.DATE,
        default: Sequelize.NOW,
        allowNull: false,
    },
})

// system plugins 
const SysPluginsDb = sequelize.define('sys_plugins', {
    uid: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    author: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    status: {
        type: Sequelize.STRING,
        allowNull: false,
        default: '0',
        comment: '0/stop 1/using',
    },
    description: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    url: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    localUrl: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    version: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    icon: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    homepage: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    settings: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'plugin settings json',
    },
    options: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'plugin settings value',
    },
    crt_tm: {
        type: Sequelize.DATE,
        default: Sequelize.NOW,
        allowNull: false,
    },
    upd_tm: {
        type: Sequelize.DATE,
        default: Sequelize.NOW,
        allowNull: false,
    },
})

module.exports = { SysDownloadDb, SysUsersDb, SysPluginsDb, sequelize }