const request = require('request')

/**
 * @description: generate feishu hooks request body
 * @param {string} text  title
 * @param {string} More   body 
 * @return {object} Request body
 */
const getFeiShuBody = (text, More) => {
    const content = []
    if (text) {
        content.push([{
            tag: 'text',
            text: `${text}`,
        }])
    }
    if (More) {
        content.push([{
            tag: 'text',
            text: `${More}`,
        }])
    }
    return {
        msg_type: 'post',
        content: {
            post: {
                zh_cn: {
                    title: '文件下载通知',
                    content,
                },
            },
        },
    }
}

const getDingDingBody = (text, More) => {
    const obj = {
        msgtype: 'text',
        text: {
            content: `文件下载通知: \n ${text} ${More || ''}`,
        },
        at: {
            isAtAll: true,
        },
    }
    return obj
}

/**
 * @description handler url  contains unescaped characters
 * @date 3/16/2023 - 11:46:23 AM
 * @param {string} url
 * @returns {*}
 */
const handlerURL = (url) => {
    const cnList = Array.from(url.matchAll(/[\u4e00-\u9fa5]+/g))
    for (let match of cnList) {
        url = url.replace(match[0], encodeURIComponent(match[0]))
    }
    return url
}

/**
 * @description get bark request url
 * @date 3/16/2023 - 11:45:35 AM
 * @param {string} url bark URL
 * @param {string} text video name
 * @returns {*}
 */
const getBarkUrl = (url, text) => handlerURL(String(url).replace(/\$TEXT/g, text))

/**
 * @description: send message notice to user
 * @param {string} url hooks url
 * @param {string} type hooks type
 * @param {string} Text title text
 * @param {string} More body text
 * @return {void}
 */
const msg = (url, type, Text, More) => {
    const URL = type === 'bark' ? getBarkUrl(url, Text) : url
    const method = type === 'bark' ? 'GET' : 'POST'
    const bodyHanler = { bark: () => ({}), feishu: getFeiShuBody, dingding: getDingDingBody }
    const data = bodyHanler[type](Text, More)
    return new Promise((resolve, reject) => {
        if (!URL) { 
            reject(new Error('please set webhooks')) 
        } else {
            request({
                url: URL,
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            }, (error, _, body) => {
                if (error) {
                    reject(error)
                }
                if (body) {
                    resolve('notification success !')
                }
            }) 
        }
    })
}

module.exports = { msg }