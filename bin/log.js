/* createLogger  */
const { format, createLogger } = require('winston')
const path = require('path')
const DailyRotateFile = require('winston-daily-rotate-file')

const logPath = path.join(process.cwd(), 'logs')

const log = (() => {
    let logger
    if (!logger) {
        logger = createLogger({
            transports: [
                new DailyRotateFile({
                    filename: path.join(logPath, 'server_%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    level: 'info',
                    format: format.combine(
                        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                        format.align(),
                        format.printf((info) => `${info.level}: ${[info.timestamp]}: ${info.message}`),
                    ),
                }),
            ],
        })
    }
    return logger
})()

module.exports = log