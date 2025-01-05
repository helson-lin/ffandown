const fs = require('fs')
const path = require('path')

const i18n = {
    lang: 'en',
    parseAcceptLanguage(header) {
        if (!header) {
            return 'en' // Default language
        }

        // Split the header string by comma to get individual language entries
        const languages = header.split(',')

        // Extract the language code and priority in descending order of quality values
        const sortedLanguages = languages
        .map(lang => {
            const [code, q = 'q=1'] = lang.trim().split(';')
            return {
                code: code.split('-')[0], // Get language code, ignore region
                priority: parseFloat(q.split('=')[1]),
            }
        })
        .sort((a, b) => b.priority - a.priority) // Sort by priority descending

        // Return the highest priority language code
        return sortedLanguages.length > 0 ? sortedLanguages[0].code : 'en'
    },
    setLocale(lang) {
        if (!lang) return
        this.lang = this.parseAcceptLanguage(lang)
    },
    _: function (key) { // 改为标准函数表达式
        try {
            if (!key) return ''
            const langPath = path.join(process.cwd(), `/locales/${this.lang}.json`)
            const jsonStr = fs.readFileSync(langPath, 'utf-8')
            const data = JSON.parse(jsonStr)
            return data?.[key] || key
        } catch {
            return key
        }
    },
}

module.exports = i18n
