const path = require('path');
const forever = require('forever-monitor');
const { format, createLogger, transports } = require('winston');
const logPath = path.join(process.cwd(), 'logs/monitor.log')
const logger = createLogger({
    transports: [
        new transports.File({
            filename: logPath,
            level: "info",
            format: format.combine(
                format.timestamp({ format: "MMM-DD-YYYY HH:mm:ss" }),
                format.align(),
                format.printf(
                    (info) =>
                        `${info.level}: ${[info.timestamp]}: ${info.message}`
                )
            ),
        }),
    ]
});
try {
    var child = new (forever.Monitor)('index.js', {
        max: 3,
        silent: true,
        args: [],
        sourceDir: path.join(__dirname, './'),
    });
    child.on('watch:restart', function (info) {
        logger.error('Restarting script because ' + info.file + ' changed');
    });

    child.on('start', function () {
        logger.info('守护进程已启动');
    });

    child.on('stdout', (data) => {
        process.stdout.write("stdout: " + data)
    });
    child.on('stderr', (data) => {
        process.stderr.write("stderr" + data)
    });
    child.on('exit', function () {
        logger.log('index.js has exited after 3 restarts');
    });

    child.start();
} catch (err) {
    logger.error("Process exit, Error: " + err)
    process.exit(0)
}
