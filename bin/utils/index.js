const CONFIG = require('./config')
const ENV = require('./env')
const CORE = require('./core')
const PROCESS = require('./process')
const UPDATE = require('./checkUpdate')
module.exports = {
    ...CONFIG,
    ...ENV,
    ...CORE,
    ...PROCESS,
    UPDATE,
}