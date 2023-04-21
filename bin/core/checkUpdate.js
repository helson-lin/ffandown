const request = require('request')
const { version } = require('../../package.json')
/**
 * @description handler version string to number for comparation
 * @param {string} version  version
 * @returns {string}
 */
const handlerVersionString = (version) => {
    const _version = Number(version.replace('v', '').replace('.', ''))
    if ((_version + '').length < 3) {
        return Number(_version + '0')
    }
    return _version
}
/**
 * @description compare local version to github releases version
 * @returns {Promise<{update: boolean, msg: string | null}>} 
 */
const getUpdate = () => {
    return new Promise((resolve, reject) => {
        request({
            url: 'https://api.github.com/repos/helson-lin/ffandown/releases/latest',
            headers: { 'User-agent': '' },
        }, (err, response, body) => {
            if (err) reject(err)
            if (response.statusCode === 200) {
                const { name, body: msg } = JSON.parse(body)
                const onLineVersion = handlerVersionString(name)
                const localVersion = handlerVersionString(version)
                if (onLineVersion > localVersion) {
                    resolve({ update: true, msg })
                } else {
                    resolve({ update: false, msg: null })
                }
            } else {
                reject(new Error('Couldn\'t connect to GitHub'))
            }
        })
    })
}

module.exports = { getUpdate }