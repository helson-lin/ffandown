const CONFIG = require('./config.js')
const PROCESS = require('./process.js')
const SYSTEM = require('./system.js')
const MSG = require('./message.js')
const WSHELPER = require('./ws.js')
const VERSION = require('./version.js')
const LOG = require('./log.js')
module.exports = {
    ...CONFIG,
    ...PROCESS,
    ...SYSTEM,
    ...MSG,
    ...WSHELPER,
    ...VERSION,
    LOG,
}