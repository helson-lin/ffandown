const request = require('request')
const { version } = require('../../package.json')

const getUpdate = () => {
    return new Promise((resolve, reject) => {
        request({
            url: 'https://api.github.com/repos/helson-lin/ffandown/releases/latest',
            headers: { 'User-agent': '' },
        }, (err, response, body) => {
            if (err) reject(err)
            if (response.statusCode === 200) {
                const { name, body: msg } = JSON.parse(body)
                const onLineVersion = Number(name.replace('v', ''))
                const localVersion = Number(version)
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