/* createLogger  */
const { format, createLogger, transports } = require('winston')
const path = require('path')
const DailyRotateFile = require('winston-daily-rotate-file')
const logPath = path.join(process.cwd(), 'logs')
const isDebug = process.argv.slice(2).findIndex(i => i.indexOf('debug') !== -1) !== -1
const getTransport = () => {
    const transport = [
        new transports.Console({
            level: 'info',
            format: format.combine(
                format.colorize({ all: false, level: true, message: false }),
                format.align(),
                format.simple(),
            ),
        }),
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
    ]
    if (!isDebug) transport.shift()
    return transport
}

const log = (() => {
    let logger
    if (!logger) logger = createLogger({ transports: getTransport() })
    return logger
})()

module.exports = log