/* createLogger  */
const { format, createLogger, transports } = require('winston')
const path = require('path')
const logPath = path.join(process.cwd(), 'logs/server.log')
const log = (() => {
    let logger
    if (!logger) {
        logger = createLogger({
            transports: [
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