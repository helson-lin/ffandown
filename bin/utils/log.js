/* createLogger  */
const { format, createLogger, transports } = require('winston')
const { combine, timestamp, label, printf, colorize } = format
const path = require('path')
const logPath = path.join(process.cwd(), 'logs/server.log')

const customFormat = printf(({ level, message, label, timestamp }) => {
    return `[${timestamp}] [${label}] ${level}: ${message}`
})

const log = (() => {
    let logger
    if (!logger) {
        logger = createLogger({
            transports: [
                new transports.Console({
                    format:  combine(
                        label({ label: 'App' }), // 可自定义标签
                        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 添加时间戳
                        colorize(), // 给日志级别上色
                        customFormat, // 应用自定义格式
                    ),
                }),
                new transports.File({
                    filename: logPath,
                    level: 'info',
                    fileTransferThreshold: 1024 * 1024,
                    fileRotationInterval: 1000 * 60 * 60 * 24,
                    format: format.combine(
                        format.timestamp({ format: 'MMM-DD-YYYY HH:mm:ss' }),
                        format.align(),
                        format.printf(
                            (info) =>
                                `${info.level}: ${[info.timestamp]}: ${info.message}`,
                        ),
                    ),
                }),
            ],
        })
    }
    return logger
})()

module.exports = log