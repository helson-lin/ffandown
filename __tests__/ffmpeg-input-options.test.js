/* eslint-env jest */

const ffmpeg = require('fluent-ffmpeg')

jest.mock('../bin/utils/index', () => ({
    LOG: {
        info: jest.fn(),
        error: jest.fn(),
        verbose: jest.fn(),
    },
}))

const FfmpegHelper = require('../bin/core/index')

const inputArguments = (url, protocolType, headers = []) => {
    const helper = new FfmpegHelper()
    helper.setInputFile(url).setHeaders(headers)
    helper.PROTOCOL_TYPE = protocolType
    helper.ffmpegCmd = ffmpeg(url)
    helper.setInputOption()
    return helper.ffmpegCmd._getArguments()
}

describe('FFmpeg input options by protocol', () => {
    beforeAll(() => {
        jest.spyOn(FfmpegHelper.prototype, 'collectSystemInfo').mockImplementation(() => {})
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    it('does not pass RTSP transport or HTTP headers to RTMP inputs (#83)', () => {
        const args = inputArguments('rtmp://127.0.0.1/live/test', 'live', [
            { key: 'Cookie', value: 'test=value' },
        ])

        expect(args).not.toContain('-rtsp_transport')
        expect(args).not.toContain('-buffer_size')
        expect(args).not.toContain('-headers')
        expect(args).not.toContain('-cookies')
        expect(args).toEqual(expect.arrayContaining([
            '-probesize', '32M', '-analyzeduration', '0',
        ]))
    })

    it('keeps TCP transport and probing options for RTSP inputs', () => {
        const args = inputArguments('rtsp://127.0.0.1/live/test', 'live')

        expect(args.slice(0, 8)).toEqual([
            '-rtsp_transport',
            'tcp',
            '-buffer_size',
            '1024000',
            '-probesize',
            '32M',
            '-analyzeduration',
            '0',
        ])
        expect(args).not.toContain('-headers')
    })

    it.each(['http', 'https'])('keeps headers and reconnect options for %s HLS inputs', (protocol) => {
        const args = inputArguments(`${protocol}://example.com/video.m3u8`, 'm3u8', [
            { key: 'User-Agent', value: 'test-agent' },
        ])

        expect(args).not.toContain('-rtsp_transport')
        expect(args[args.indexOf('-headers') + 1]).toContain('User-Agent: test-agent')
        expect(args[args.indexOf('-headers') + 1]).toContain(`Referer: ${protocol}://example.com`)
        expect(args).toEqual(expect.arrayContaining([
            '-rw_timeout',
            '30000000',
            '-reconnect',
            '1',
            '-reconnect_at_eof',
            '1',
            '-reconnect_delay_max',
            '4',
        ]))
    })
})
