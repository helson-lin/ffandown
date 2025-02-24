const express = require('express')
const userRouter = express.Router()
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()
const UserService = require('../sql/userService')
const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcrypt')
const validate = require('../middleware/validate')
const { body } = require('express-validator')
const i18n = require('../utils/locale')

function createUserRouter () {
    userRouter.post('/register', [jsonParser, validate([
        body('username').isString().notEmpty().withMessage('username is required'),
        body('password').isString().notEmpty().withMessage('password is required'),
    ])], async (req, res) => {
        try {
            const { username, password } = req.body
            // 判断是否存在相同的角色
            const userFined = await UserService.queryByUsername(username)
            if (userFined && userFined.username === username) {
                res.send({ code: 0, message:  i18n._('user_registed') })
            } else {
                const hashedPassword = await bcrypt.hash(password, 10)
                const user = await UserService.create({ uid: uuidv4(), username, password: hashedPassword, on: '1' })
                res.send({ code: 0, data: { username, password, uid: user?.uid } })
            }
        } catch (e) {
            res.send({ code: 1, message: e.message })
        }
    })

    userRouter.post('/login', [jsonParser, validate([
        body('username').isString().notEmpty().withMessage('username is required'),
        body('password').isString().notEmpty().withMessage('password is required'),
    ])], async (req, res) => {
        const { username, password } = req.body
        const userCount = await UserService.count()
        // 判断一些数据库内是否存在用户数据，如果没有那么默认登录的第一个用户会自动新增到数据库内
        if (userCount === 0) {
            const hashedPassword = await bcrypt.hash(password, 10)
            await UserService.create({ uid: uuidv4(), username, password: hashedPassword, on: '1' })
            req.session.user = { username }
            return res.send({ message: i18n._('login_success'), code: 0, user: req.session.user })
        } else {
            const user = await UserService.queryByUsername(username)
            if (user?.password && await bcrypt.compare(password, user?.password)) {
                req.session.user = { username }
                return res.send({ message: i18n._('login_success'), code: 0, user: req.session.user })
            } else {
                res.send({
                    code: 1,
                    message: i18n._('login_failed'),
                })
            }
        }
    })

    userRouter.post('/resetPassword', [jsonParser, validate([
        body('username').isString().notEmpty().withMessage('username is required'),
        body('password').isString().notEmpty().withMessage('password is required'),
    ])], async (req, res) => {
        try {
            const { username, password } = req.body
            const userFined = await UserService.queryByUsername(username)
            if (userFined && userFined.username === username) {
                const user = await UserService.update(userFined?.uid, { password })
                res.send({ code: 0, data: {  username: user.username } })
            } else {
                res.send({ code: 1, message: i18n._('query_error')  })
            }
        } catch (e) {
            res.send({ code: 1, message: e.message })
        }
    })
    return userRouter
}

module.exports = createUserRouter
