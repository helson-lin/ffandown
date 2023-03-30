let ffmpeg = require('fluent-ffmpeg')

class LiveRecorder {
    /**
   * Sets the input file
   * @param {String} filename M3U8 file path. You can use remote URL
   * @returns {Function}
   */
    setInputFile (url) {
        this.RECORDER_URl = url
        return this
    }

    /**
   * Sets the output file
   * @param {String} filename Output file path. Has to be local :)
   * @returns {Function}
   */
    setOutputFile (filename) {
        this.DOWNLOAD_FILENAME = filename
        return this
    }

    /**
   * Sets the thread
   * @param {Number} number thread number
   * @returns {Function}
   */
    setThreads (number) {
        if (number) {
            this.THREADS = number
        }
        return this
    }

    start () {
        return new Promise((resolve, reject) => {
            if (!this.RECORDER_URl || !this.DOWNLOAD_FILENAME) {
                reject(new Error('You must specify the input and the output files'))
                return
            }
            const ffmpegCmd = ffmpeg(this.RECORDER_URl)
            .on('error', error => {
                reject(new Error(error))
            })
            .on('end', () => {
                resolve()
            })
            if (this.THREADS) {
                ffmpegCmd.outputOptions(`-threads ${this.THREADS}`)
                ffmpegCmd.outputOptions('-preset ultrafast')
            }
            ffmpegCmd.outputOptions('-c:v copy')
            .outputOptions('-c:a aac')
            .outputOptions('-b:a 128k')
            .output(this.DOWNLOAD_FILENAME)
            ffmpegCmd.run()
        })
    }
}

module.exports = LiveRecorder