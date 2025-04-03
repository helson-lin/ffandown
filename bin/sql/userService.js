const { SysUsersDb } = require('./entity')
const UserService = {
    async create (body) {
        try {
            const time = new Date().toISOString()
            const userDto = await SysUsersDb.create({ ...body, crt_tm: time, upd_tm: time })
            return Promise.resolve(userDto)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async delete (uid) {
        try {
            const userDto = await SysUsersDb.destroy({ where: { uid } })
            return Promise.resolve(userDto)
        } catch (e) { 
            return Promise.reject(e)
        }
    },
    async count () {
        try {
            return await SysUsersDb.count()
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async update (uid, body) {
        try {
            const user = body
            if (!user.upd_tm) user.upd_tm = new Date().toISOString()
            const userDto = await SysUsersDb.update(user, { where: { uid }, raw: true })
            return Promise.resolve(userDto)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async getAll () {
        try {
            const all = await SysUsersDb.findAll()
            return Promise.resolve(all)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async queryOne (uid) {
        try {
            const mission = await SysUsersDb.findOne({ where: { uid } })
            return Promise.resolve(mission)
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async queryByUsername (username) {
        try {
            const user = await SysUsersDb.findOne({ where: { username } })
            return user?.toJSON()
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async queryByForm (username, password) {
        try {
            console.log(username, password)
            const user = await SysUsersDb.findOne({ where: { username } })
            return user && user.toJSON()
        } catch (e) {
            return Promise.reject(e)
        }
    },
    async batchDelete (uids) {
        try {
            return await SysUsersDb.destroy({
                where: {
                    uid: uids,
                },
            })
        } catch (e) {
            return Promise.reject(e)
        }
    },
}

module.exports = UserService