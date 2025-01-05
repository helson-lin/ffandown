const request = require('request')
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

const getBarkInfo = ({
    url,
    more,
    text,
}) => {
    return {
        url: handlerURL(String(url).replace(/\$TEXT/g, 
            encodeURIComponent(text) + '/' + encodeURIComponent(more || ''),
        )),
        method: 'GET',
        data: {},
    }
}

const getFeiShuInfo = ({
    url,
    more,
}) => {
    const content = []
    if (more) {
        content.push([{
            tag: 'text',
            text: more,
        }])
    }
    return {
        url,
        method: 'POST',
        data: {
            msg_type: 'post',
            content: {
                post: {
                    zh_cn: {
                        title: 'ffandown',
                        content,
                    },
                },
            },
        },
    }
}


const getDingDingInfo = ({
    url,
    more,
}) => {
    return {
        url,
        method: 'POST',
        data: {
            msgtype: 'text',
            text: {
                content: more || '',
            },
            at: {
                isAtAll: true,
            },
        },
    }
}

const getGotifyInfo = ({
    url,
    text,
    more,
}) => {
    return {
        url,
        method: 'POST',
        data: {
            'message': more || '',
            'title': text || '',
            'priority': 2,
            'extras': {
                'client::display': {
                    'contentType': 'text/markdown',
                },
            },
        },
    }
}
/**
 * @description: send message notice to user
 * @param {string} url hooks url
 * @param {string} type hooks type
 * @param {string} Text title text
 * @param {string} More body text
 * @return {void}
 */
const msg = (url, type, text, more) => {
    const msgHandlerMap = {
        'bark': getBarkInfo,
        'feishu': getFeiShuInfo,
        'dingding': getDingDingInfo,
        'gotify': getGotifyInfo,
    }
    const handler = msgHandlerMap[type]
    if (!handler || typeof handler !== 'function') return
    const sendInfo  = handler({ url, text, more })
    return new Promise((resolve, reject) => {
        if (!sendInfo.url) { 
            reject(new Error('please set webhooks')) 
        } else {
            request({
                url: sendInfo.url,
                method: sendInfo.method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sendInfo.data),
            }, (error, _, body) => {
                if (error) {
                    console.log(error)
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