/**
 * Utils 模块统一导出
 * 集中管理所有工具函数和配置
 */

// 配置相关
const CONFIG = require('./config.js')

// 系统相关
const SYSTEM = require('./system.js')

// 消息和通信
const MSG = require('./message.js')
const WSHELPER = require('./ws.js')

// 工具函数
const HELPER = require('./helper.js')
const PARSER = require('./parser.js')

// 系统功能
const VERSION = require('./version.js')
const LOG = require('./log.js')

module.exports = {
    // 配置模块
    ...CONFIG,
    
    // 系统模块
    ...SYSTEM,
    
    // 通信模块
    ...MSG,
    ...WSHELPER,
    
    // 工具模块
    HELPER,
    ...PARSER,
    
    // 功能模块
    ...VERSION,
    LOG,
}