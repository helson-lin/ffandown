const { validationResult } = require('express-validator')
const i18n = require('../utils/locale')

const validate = (validations) => {
    return async (req, res, next) => {
        // 执行验证
        await Promise.all(
            validations.map(validation => validation.run(req)),
        )

        // 获取验证结果
        const errors = validationResult(req)

        // 如果有错误，返回 400 Bad Request 响应
        const message = errors.array().reduce((pre, val) => {
            return pre + `${val.msg}. `
        }, '')
        if (!errors.isEmpty()) {
            return res.status(400).json({
                code: 1,
                message,
            })
        }

        // 验证通过，继续处理
        next()
    }
}



module.exports = validate