const fetch = require('node-fetch')
const tiktok = {
    match (url) {
        const matchUrl = url.match(/https:\S+/)
        return matchUrl && matchUrl[0]?.indexOf('v.douyin') !== -1
    },
    getRoomIdByShareUrl (url) {
        const headers = {
            authority: 'v.douyin.com',
            // eslint-disable-next-line max-len
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1',
        }
        return new Promise((resolve, reject) => {
            console.log(url)
            fetch(url, headers).then((res) => {
                if (!res?.url) reject(new Error('can\'t get room id'))
                const roomId = res?.url?.match(/\d{19}/)[0]
                if (!roomId) reject(new Error('can\'t get room id'))
                resolve(roomId)
            })
        })
    },
    async liveUrl (roomId) {
        const headers = {}
        headers.authority = 'webcast.amemv.com'
        // eslint-disable-next-line max-len
        headers.cookie = '_tea_utm_cache_1128={%22utm_source%22:%22copy%22%2C%22utm_medium%22:%22android%22%2C%22utm_campaign%22:%22client_share%22}'
        const params = {
            type_id: '0',
            live_id: '1',
            room_id: roomId,
            app_id: '1128',
        }
        let url = 'https://webcast.amemv.com/webcast/room/reflow/info?'
        for (const key in params) {
            url += `${key}=${params[key]}&`
        }
        url = url.slice(0, -1)
        return new Promise((resolve, reject) => {
            try {
                fetch(url, headers).then(async (res) => {
                    const data = await res.json()
                    // eslint-disable-next-line camelcase
                    const { resolution_name, flv_pull_url, hls_pull_url_map } = data?.data?.room.stream_url
                    // const resData = {}
                    // eslint-disable-next-line camelcase
                    resolve({ resolution_name, flv_pull_url, hls_pull_url_map })
                }).catch(err => reject(err))
            } catch (e) {
                reject(e)
            }
        })
    },
    async parser (url) { 
        try {
            const matchUrl = url.match(/https:\S+/)
            const roomId = await this.getRoomIdByShareUrl(matchUrl[0])
            const res = await this.liveUrl(roomId)
            return res.hls_pull_url_map.FULL_HD1
        } catch (e) {
            return null
        }
    },
}

module.exports = tiktok