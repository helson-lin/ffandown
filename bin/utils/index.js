const CONFIG = require('./config')
const PROCESS = require('./process')
const SYSTEM = require('./system')
const MSG = require('./message')
const WSHELPER = require('./ws')
const LOG = require('./log')
module.exports = {
    ...CONFIG,
    ...PROCESS,
    ...SYSTEM,
    ...MSG,
    ...WSHELPER,
    LOG,
}