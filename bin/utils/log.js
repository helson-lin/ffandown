/* createLogger  */
const { format, createLogger, transports } = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const path = require('path')
const { combine, timestamp, label, printf } = format
const logPath = (type) => path.join(process.cwd(), `logs/${type || 'server'}.log`)

const customFormat = printf(({ level, message, label, timestamp }) => {
    return `[${timestamp}] [${label}] [${level}]: ${message}`
})

const log = (() => {
    let logger
    if (!logger) {
        logger = createLogger({
            format: combine(
                label({ label: 'ffandown' }),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                customFormat,
            ),
            transports: [
                new DailyRotateFile({
                    filename: logPath('server'),
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '2m',
                    maxFiles: '5d',
                    format: combine(
                        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                        customFormat,
                    ),
                }),
            ],
        })
    }
    if (process.env.NODE_ENV === 'development') {
        // 开发环境设置 Console 输出日志
        logger.add(new transports.Console({
            level: 'debug',
            format: combine(
                format.colorize(),
                customFormat,
            ),
        }))
    }
    return logger
})()

module.exports = log