const fetch = require('node-fetch')
const bilibili = {
    match (url) {
        const matchUrl = url.match(/https:\S+/)
        console.log(matchUrl && matchUrl[0]?.indexOf('b23.tv') !== -1)
        return matchUrl && matchUrl[0]?.indexOf('b23.tv') !== -1
    },
    getRoomIdByShareUrl (url) {
        const headers = {
            authority: 'live.bilibili.com',
            // eslint-disable-next-line max-len
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1',
        }
        return new Promise((resolve, reject) => {
            fetch(url, headers).then((res) => {
                if (!res?.url) reject(new Error('can\'t get room id'))
                console.log(res)
                const roomId = res?.url?.match(/\d{8}/)[0]
                if (!roomId) reject(new Error('can\'t get room id'))
                resolve(roomId)
            })
        })
    },
    getUrlByRoomId (roomId) {
        const params = {
            room_id: roomId,
            no_playurl: '0',
            mask: '1',
            platform: 'web',
            qn: '0',
            protocol: '0,1',
            format: '0,2',
            codec: '0,1',
        }
        let url = 'https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?'
        for (const key in params) {
            url += `${key}=${params[key]}&`
        }
        url = url.slice(0, url.length - 1)
        console.log(url)
        return new Promise((resolve, reject) => {
            fetch(url).then((res) => resolve(res)).catch(err => reject(err))
        })
    },
    async parser (url) {
        try {
            const roomId = await this.getRoomIdByShareUrl(url)
            console.log('roomId', roomId)
            const res = await this.getUrlByRoomId(roomId)
            const data = await res.json()
            return data
        } catch (e) {
            return null
        }
    },
}

module.exports = bilibili