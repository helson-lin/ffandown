const Utils = require('../utils/index')

/**
 * 请求计时中间件
 * 记录每个请求的开始和结束时间，帮助识别长时间运行的请求
 */
function requestLogger(req, res, next) {
    // 跳过对静态资源的监控
    if (req.path.startsWith('/public')) {
        return next()
    }
    
    const start = Date.now()
    const requestId = Math.random().toString(36).substr(2, 9)
    
    // 记录请求开始
    Utils.LOG.info(`[${requestId}] Request to start: ${req.method} ${req.originalUrl}`)
    
    // 为响应对象添加 finish 事件监听器
    res.on('finish', () => {
        const duration = Date.now() - start
        const logLevel = duration > 1000 ? 'warn' : 'info'
        
        Utils.LOG[logLevel](
            `[${requestId}] Request complete: ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`,
        )
        
        if (duration > 1000) {
            // 记录响应时间超过1秒的请求，可帮助识别慢请求
            Utils.LOG.warn(`[${requestId}] Slow request: ${req.method} ${req.originalUrl} - ${duration}ms`)
        }
    })
    
    // 监听连接关闭事件
    res.on('close', () => {
        if (!res.finished) {
            const duration = Date.now() - start
            // SSE 连接关闭是正常行为，记录为 info 而不是 error
            const isSSE = req.originalUrl.includes('/sse') || res.getHeader('Content-Type') === 'text/event-stream'
            const logLevel = isSSE ? 'info' : 'error'
            const message = isSSE ? 'SSE connection closed' : 'Request interrupted'
            Utils.LOG[logLevel](`[${requestId}] ${message}: ${req.method} ${req.originalUrl} - ${duration}ms`)
        }
    })
    
    next()
}

module.exports = requestLogger