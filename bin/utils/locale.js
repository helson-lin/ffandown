const fs = require('fs')
const path = require('path')

// 缓存翻译文件，避免重复读取
const translationCache = new Map()

const i18n = {
    // 默认语言
    _lang: 'en',
  
    // 解析 Accept-Language 头部
    parseAcceptLanguage(header) {
        if (!header) {
            return 'en'
        }

        const languages = header.split(',')
        const sortedLanguages = languages
        .map(lang => {
            const [code, q = 'q=1'] = lang.trim().split(';')
            return {
                code: code.split('-')[0], // 获取语言代码，忽略区域
                priority: parseFloat(q.split('=')[1]),
            }
        })
        .sort((a, b) => b.priority - a.priority)

        return sortedLanguages.length > 0 ? sortedLanguages[0].code : 'en'
    },
    // 设置语言
    setLocale(value) {
        this._lang = this.parseAcceptLanguage(value)
    },
    // 自动检测并设置语言
    detectAndSetLanguage() {
        // 在 Node.js 环境中，尝试从请求头中获取语言
        if (global.req && global.req.headers && global.req.headers['accept-language']) {
            this._lang = this.parseAcceptLanguage(global.req.headers['accept-language'])
        }
        return this._lang
    },
  
    // 获取翻译内容
    _: function(key) {
        if (!key) return ''
    
        try {
            // 检查缓存中是否有该语言的翻译
            if (!translationCache.has(this._lang)) {
                const langPath = path.join(process.cwd(), `/locales/${this._lang}.json`)
                const jsonStr = fs.readFileSync(langPath, 'utf-8')
                translationCache.set(this._lang, JSON.parse(jsonStr))
            }
      
            const translations = translationCache.get(this._lang)
            return translations[key] || key
        } catch (error) {
            console.error(`Translation error for key "${key}":`, error.message)
            return key
        }
    },
  
    // 清除缓存
    clearCache() {
        translationCache.clear()
    },
}

module.exports = i18n
