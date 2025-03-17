const { SysDownloadDb } = require('./entity')
const { Op } = require('sequelize')
const DownloadService = {
    /**
     * @description create download record
     * @param {*} param {uid, name, url, percent, filePath, status, speed} 
     * @returns 
     */
    async create (body) {
        try {
            const time = new Date().toISOString()
            const download = await SysDownloadDb.create({ ...body, crt_tm: time, upd_tm: time })
            return Promise.resolve(download)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async delete (uid) {
        try {
            const deletedRes = await SysDownloadDb.destroy({ where: { uid } })
            return Promise.resolve(deletedRes)
        } catch (e) { 
            return Promise.reject(e)
        }
    },
    async update (uid, body) {
        try {
            const mission = body
            if (!mission.upd_tm) mission.upd_tm = new Date().toISOString()
            const download = await SysDownloadDb.update(mission, { where: { uid } })
            return Promise.resolve(download)
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
    async queryOne (uid) {
        try {
            const mission = await SysDownloadDb.findOne({ where: { uid } })
            return Promise.resolve(mission)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async queryByPage ({ pageNumber = 1, pageSize = 1, sortField = 'crt_tm', sortOrder = 'DESC', status = '1' }) {
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
            const { count, rows } = await SysDownloadDb.findAndCountAll(options)
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
    // 获取等待中的下载任务
    async queryMissionByType (type = 'waiting') {
        const statusMap = {
            waiting: ['5'],
            downloading: ['0', '1', '2'],
            finished: ['3', '4'],
            needResume: ['5'], // 可以恢复下载或者初始化时等待下载的任务 3/4不需要管
        }
        try {
            const allMissions = await SysDownloadDb.findAll({ 
                where: { status: { [Op.in]: statusMap[type] } }, 
                order: [['crt_tm', 'ASC']],
            })
            return Promise.resolve(allMissions)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    // 批量删除下载任务
    async batchDelete (uids) {
        try {
            return await SysDownloadDb.destroy({
                where: {
                    uid: uids,
                },
            })
        } catch (e) {
            return Promise.reject(e)
        }
    },
}

module.exports = DownloadService