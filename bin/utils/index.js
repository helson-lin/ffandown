const CONFIG = require('./config')
const ENV = require('./env')
const PROCESS = require('./process')
module.exports = {
    ...CONFIG,
    ...ENV,
    ...PROCESS,
}