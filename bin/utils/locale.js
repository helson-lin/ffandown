const fs = require('fs')
const path = require('path')
const log = require('./log')
// 缓存翻译文件，避免重复读取
const translationCache = new Map()

// 获取应用程序根目录
const getAppRoot = () => {
    if (process.env.NODE_ENV === 'development') {
        return process.cwd()
    }
    return path.join(__dirname, '../../')
}

// 使用闭包创建 i18n 实例
const createI18n = () => {
    // 私有变量
    let _lang = 'en'
    let _initialized = false

    // 解析 Accept-Language 头部
    const parseAcceptLanguage = (header) => {
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
    }

    // 初始化语言设置
    const initialize = () => {
        if (_initialized) return

        // 尝试从环境变量获取语言设置
        const envLang = process.env.LANG || process.env.LANGUAGE
        if (envLang) {
            _lang = parseAcceptLanguage(envLang)
        }

        // 尝试从系统获取语言设置
        try {
            const systemLang = require('os').locale()
            if (systemLang) {
                _lang = parseAcceptLanguage(systemLang)
            }
        } catch (error) {
            log.warn('Failed to get system locale:', error)
        }

        _initialized = true
    }

    // 获取翻译内容
    const translate = (key) => {
        if (!key) return ''

        try {
            // 检查缓存中是否有该语言的翻译
            if (!translationCache.has(_lang)) {
                const appRoot = getAppRoot()
                const langPath = path.join(appRoot, 'locales', `${_lang}.json`)
                
                if (fs.existsSync(langPath)) {
                    const jsonStr = fs.readFileSync(langPath, 'utf-8')
                    translationCache.set(_lang, JSON.parse(jsonStr))
                } else {
                    // 如果找不到指定语言的翻译文件，使用英语
                    const enPath = path.join(appRoot, 'locales', 'en.json')
                    if (fs.existsSync(enPath)) {
                        const jsonStr = fs.readFileSync(enPath, 'utf-8')
                        translationCache.set(_lang, JSON.parse(jsonStr))
                    } else {
                        // 如果连英文翻译文件都找不到，返回 key
                        log.warn(`Translation file not found for language: ${_lang}`)
                        return key
                    }
                }
            }

            const translations = translationCache.get(_lang)
            return translations[key] || key
        } catch (error) {
            return key
        }
    }

    // 公共 API
    return {
        // 设置语言
        setLocale(value) {
            if (value) {
                _lang = parseAcceptLanguage(value)
                // 清除缓存，强制重新加载翻译
                translationCache.delete(_lang)
            }
        },

        // 获取当前语言
        getLocale() {
            return _lang
        },

        // 自动检测并设置语言
        detectAndSetLanguage() {
            initialize()
            return _lang
        },

        // 翻译函数
        _: translate,

        // 清除缓存
        clearCache() {
            translationCache.clear()
        },

        // 获取所有可用的语言
        getAvailableLanguages() {
            try {
                const appRoot = getAppRoot()
                const localesDir = path.join(appRoot, 'locales')
                if (!fs.existsSync(localesDir)) {
                    return ['en']
                }
                return fs.readdirSync(localesDir)
                    .filter(file => file.endsWith('.json'))
                    .map(file => file.replace('.json', ''))
            } catch (error) {
                log.error('Failed to get available languages:', error)
                return ['en']
            }
        },

        // 检查语言是否可用
        isLanguageAvailable(lang) {
            return this.getAvailableLanguages().includes(lang)
        }
    }
}

// 创建单例实例
const i18n = createI18n()

// 导出单例
module.exports = i18n
