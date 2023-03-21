const CONFIG = require('./config')
const ENV = require('./env')
const CORE = require('./core')
const PROCESS = require('./process')
module.exports = {
    ...CONFIG,
    ...ENV,
    ...CORE,
    ...PROCESS,
}