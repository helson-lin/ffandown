
const UserService = require('../sql/userService')
const bcrypt = require('bcrypt')

async function checkAuth (req, res, next) {
    const publicRoutes = ['/user/login', '/public'] // 不需要鉴权的路由列表
    // 如果请求的路由在公开路由列表中，直接放行
    if (publicRoutes.includes(req.path)) {
        return next()
    }
    const sessionUser = req.session?.user?.username
    const queryUsername = req.body?.username || req.query?.username
    const queryPassword = req.body?.password || req.query?.password
    if (sessionUser) {
        next()
    } else if (queryUsername && queryPassword) {
        const user = await UserService.queryByUsername(queryUsername)
        if (user?.password && await bcrypt.compare(queryPassword, user?.password)) {
            next()
        } else {
            res.status(401).send({ code: 1 })
        }
    } else {
        res.status(401).send({ code: 1, message: 'Invalid credentials' })
    }
}

module.exports = checkAuth