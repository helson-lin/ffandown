const EventEmitter = require('events');
const { Parser } = require('m3u8-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');

class M3U8Downloader extends EventEmitter {
    constructor({
        url,
        filename,
        fileName,
        onProgress,
        onComplete,
        onError,
        headers,
        proxy,
        concurrency = 10, // 并发下载数量
        outputDir, // 存储目录
        maxRetries = 3, // 最大重试次数
        retryDelay = 100, // 重试延迟（毫秒）
        speedUpdateInterval = 1000, // 速度更新间隔（毫秒）
        debug = false,
        maxSegmentRetries = 5, // 单个片段最大重试次数
        skipFailedSegments = false, // 是否跳过持续失败的片段
        allowInsecureHttps = false, // 允许过期/自签名 HTTPS（不安全）
    }) {
        super(); // 调用EventEmitter的构造函数
        this.url = url;
        this.filename = filename;
        this.fileName = fileName;
        this.onProgress = onProgress;
        this.onComplete = onComplete;
        this.onError = onError;
        this.setHeaders(headers);
        this.proxy = proxy;
        this.concurrency = concurrency;
        // 生成唯一文件夹名
        const hash = crypto.createHash('md5').update(url).digest('hex');
        // 媒体文件存储的目录
        this.outputDir = outputDir || path.join('./media', hash);
        // 临时片段存储目录 - 使用 URL 生成唯一文件夹名
        this.tempSegmentsDir = path.join(this.outputDir, `temp_segments_${hash}`);
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
        this.speedUpdateInterval = speedUpdateInterval;
        // 是否开启调试模式
        this.debug = debug;
        // 新增: 单个片段的最大重试次数和是否跳过失败片段
        this.maxSegmentRetries = maxSegmentRetries;
        this.skipFailedSegments = skipFailedSegments;
        // HTTPS 证书校验控制
        this.allowInsecureHttps = !!allowInsecureHttps;
        this._insecureHttpsAgent = this.allowInsecureHttps
            ? new https.Agent({ rejectUnauthorized: false })
            : undefined;
        // node-fetch v2 支持 agent 为函数，按协议返回合适 agent
        this._getAgent = (parsedURL) => {
            if (this.allowInsecureHttps && parsedURL.protocol === 'https:') {
                return this._insecureHttpsAgent;
            }
            return undefined;
        };
        // 下载状态
        this.downloadQueue = [];
        this.activeDownloads = 0;
        this.downloadedCount = 0;
        this.failedCount = 0;
        this.retryCount = 0;
        this.skippedSegments = []; // 新增: 跳过的片段列表
        
        // 暂停和继续功能
        this.isPaused = false;
        this.isResuming = false;
        // 下载状态文件 临时存储
        this.downloadStateFile = path.join(this.tempSegmentsDir, 'download_state.json');
        
        // 速度监控 - 重新设计
        this.downloadedBytes = 0;
        this.startTime = null;
        this.lastSpeedUpdate = 0;
        this.speedWindow = []; // 滑动窗口存储最近的速度数据
        this.windowSize = 10; // 窗口大小
        this.lastBytes = 0; // 上次更新时的字节数
        this.currentSpeed = 0;
        this.averageSpeed = 0;
    }

    log(message) {
        if (this.debug) {
            console.log(message);
        }
    }

    // 设置请求头
    setHeaders (headers) {
        const defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Referer': this.url,
            'Origin': new URL(this.url).origin,
            'Host': new URL(this.url).host,
        };
        const mergedHeaders = { ...defaultHeaders, ...(headers || {}) };
        this.headers = mergedHeaders;
    }

    // 预取主播放列表
    async prefetch() {
        const parser = new Parser();
        const response = await fetch(this.url, {
            headers: this.headers,
            agent: this._getAgent,
        });
        if (response.status !== 200) {
            this.log(`prefetch url: ${this.url} prefetch headers: ${JSON.stringify(this.headers)}`)
            throw new Error(`prefetch error: HTTP ${response.status}: ${response.statusText}`);
        }
        const m3u8 = await response.text();
        // 解析主播放列表
        parser.push(m3u8);
        parser.end();
        
        // 检查是否是主播放列表（包含多个变体）
        if (parser.manifest.playlists && parser.manifest.playlists.length > 0) {
            const bestPlaylist = this.getBestStream(parser.manifest.playlists);
            // 获取最佳质量的播放列表URL
            const baseUrl = new URL(this.url);
            const playlistUrl = new URL(bestPlaylist.uri, baseUrl).toString();
            
            // 获取最佳质量播放列表的内容
            const playlistResponse = await fetch(playlistUrl, {
                headers: this.headers,
                agent: this._getAgent,
            });
            const playlistM3u8 = await playlistResponse.text();
            // 解析最佳质量播放列表的片段
            const playlistParser = new Parser();
            playlistParser.push(playlistM3u8);
            playlistParser.end();
            
            this.segments = playlistParser.manifest.segments;
            this.playlistUrl = playlistUrl;
        } else {
            // 直接是媒体播放列表
            this.segments = parser.manifest.segments;
            this.playlistUrl = this.url;
        }
        
        this.log(`总共找到 ${this.segments.length} 个片段`);
        return this.segments;
    }

    getBestStream(playlists) {
        // 按带宽排序，选择带宽最高的（质量最好的）
        const sortedPlaylists = playlists.sort((a, b) => {
            const bandwidthA = a.attributes.BANDWIDTH || 0;
            const bandwidthB = b.attributes.BANDWIDTH || 0;
            return bandwidthB - bandwidthA; // 降序排列，带宽高的在前
        });
        
        const bestPlaylist = sortedPlaylists[0];
        playlists.forEach((playlist, index) => {
            const bandwidth = playlist.attributes.BANDWIDTH || 'unknown';
            const resolution = playlist.attributes.RESOLUTION || 'unknown';
            this.log(`${index + 1}. Bandwidth: ${bandwidth}, Resolution: ${resolution.width ?? 'unknown'}x${resolution.height ?? 'unknown'}`);
        });
        
        
        return bestPlaylist;
    }

    async download() {
        // 1. 获取主播放列表
        try {
            await this.prefetch();
        } catch (error) {
            // 获取主播放列表失败
            this.emit('error', error);
            return this;
        }
        // 2. 检查是否存在可下载的片段
        if (!this.segments || this.segments.length === 0) {
            this.emit('error', new Error('No downloadable segments found'));
            return this;
        }
        // 3. 创建输出目录
        await this.ensureOutputDir();
        
        // 记录下载开始时间
        this.downloadStartTime = Date.now();
        // 4. 尝试加载之前的下载状态
        const hasPreviousState = this.loadDownloadState();
        
        // 检查已下载的片段
        const downloadedSegments = this.checkDownloadedSegments();
        
        // 5. 如果存在未完成的下载，从第 ${this.downloadedCount + 1} 个片段开始继续下载
        if (hasPreviousState && downloadedSegments.length > 0) {
            this.log(`发现未完成的下载，从第 ${this.downloadedCount + 1} 个片段开始继续下载`);
            this.emit('resuming', {
                downloadedCount: this.downloadedCount,
                totalSegments: this.segments.length,
                remainingSegments: this.segments.length - this.downloadedCount
            });
        }
        
        // 6. 初始化速度监控
        if (!this.startTime) {
            this.startTime = Date.now();
            this.lastSpeedUpdate = this.startTime;
        }
        
        // 7. 开始多线程下载片段
        await this.downloadSegmentsConcurrently();
        
        return this;
    }
    
    async ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        
        // 创建临时片段目录
        if (!fs.existsSync(this.tempSegmentsDir)) {
            fs.mkdirSync(this.tempSegmentsDir, { recursive: true });
        }
    }
    
    async downloadSegmentsConcurrently() {
        const totalSegments = this.segments.length;
        
        // 创建下载队列，跳过已下载的片段
        this.downloadQueue = [];
        for (let i = 0; i < this.segments.length; i++) {
            const filename = `segment_${String(i).padStart(6, '0')}.ts`;
            const filepath = path.join(this.tempSegmentsDir, filename);
            
            // 如果文件不存在或大小为0，加入下载队列
            if (!fs.existsSync(filepath) || fs.statSync(filepath).size === 0) {
                this.downloadQueue.push({
                    index: i,
                    segment: this.segments[i],
                    url: this.resolveSegmentUrl(this.segments[i].uri),
                    retryCount: 0
                });
            } else {
                // 文件已存在且不为空，跳过下载
                this.log(`跳过已下载的片段: ${filename}`);
            }
        }
        
        this.log(`需要下载 ${this.downloadQueue.length} 个片段，跳过 ${totalSegments - this.downloadQueue.length} 个已下载片段`);
        
        // 启动并发下载
        const downloadPromises = [];
        for (let i = 0; i < this.concurrency; i++) {
            downloadPromises.push(this.downloadWorker());
        }
        
        // 等待所有下载完成
        await Promise.all(downloadPromises);
        
        // 统计下载耗时
        const downloadElapsed = this.downloadStartTime ? (Date.now() - this.downloadStartTime) / 1000 : 0;
        // 下载完成自动合并
        this.emit('complete', { 
            totalSegments, 
            downloadedCount: this.downloadedCount,
            failedCount: this.failedCount,
            retryCount: this.retryCount,
            outputDir: this.outputDir,
            tempSegmentsDir: this.tempSegmentsDir,
            totalBytes: this.downloadedBytes,
            averageSpeed: this.averageSpeed,
            downloadElapsed
        });
        // 开始合并
        this.mergeSegmentsWithFFmpeg();
    }
    // 下载工作线程
    async downloadWorker() {
        while (this.downloadQueue.length > 0 && !this.isPaused) {
            const task = this.downloadQueue.shift();
            if (!task) break;
            
            this.activeDownloads++;
            await this.downloadSegmentWithRetry(task);
            this.activeDownloads--;
            
            // 检查是否暂停
            if (this.isPaused) {
                this.log('下载工作线程检测到暂停信号，停止工作');
                break;
            }
        }
    }

    // 格式化速度显示
    formatSpeed(bytesPerSecond) {
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        let speed = bytesPerSecond;
        let unitIndex = 0;
        
        while (speed >= 1024 && unitIndex < units.length - 1) {
            speed /= 1024;
            unitIndex++;
        }
        
        return `${speed.toFixed(2)} ${units[unitIndex]}`;
    }
    // 格式化文件大小
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    // 分片下载
    async downloadSegmentWithRetry(task) {
        const { index, segment, url, retryCount } = task;
        const filename = `segment_${String(index).padStart(6, '0')}.ts`;
        const filepath = path.join(this.tempSegmentsDir, filename);
        
        // 如果已经超过单个片段最大重试次数且跳过失败片段选项开启
        if (retryCount >= this.maxSegmentRetries && this.skipFailedSegments) {
            this.failedCount++;
            this.skippedSegments.push(index);
            console.warn(`已跳过持续失败的片段 ${index + 1}: ${filename} (已重试 ${retryCount} 次)`);
            this.emit('skip', { index, segment, filename, retryCount });
            
            // 创建一个空文件作为占位符，以便后续合并
            fs.writeFileSync(filepath, Buffer.from([0]));
            
            this.downloadedCount++;
            const progress = {
                current: this.downloadedCount,
                total: this.segments.length,
                percentage: Math.min(100, Math.round((this.downloadedCount / this.segments.length) * 100)),
                segment: segment,
                filename: filename,
                filepath: filepath,
                activeDownloads: this.activeDownloads,
                currentSpeed: this.formatSpeed(this.currentSpeed),
                averageSpeed: this.formatSpeed(this.averageSpeed),
                downloadedBytes: this.formatBytes(this.downloadedBytes),
                bytes: this.formatBytes(0),
                retryCount: this.retryCount,
                skipped: true
            };
            
            this.emit('progress', progress);
            
            // 每下载10个片段保存一次状态
            if (this.downloadedCount % 10 === 0) {
                this.saveDownloadState();
            }
            
            return;
        }
        
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                // 检查是否暂停
                if (this.isPaused) {
                    this.log(`下载已暂停，停止下载片段: ${filename}`);
                    return;
                }
                
                // this.log(`下载片段 ${index + 1}/${this.segments.length}: ${filename}${attempt > 0 ? ` (重试 ${attempt}/${this.maxRetries})` : ''}`);
                
                // 使用AbortController来控制超时
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
                const response = await fetch(url, {
                    headers: this.headers,
                    signal: controller.signal,
                    agent: this._getAgent,
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const buffer = await response.arrayBuffer();
                const bytes = buffer.byteLength;
                
                fs.writeFileSync(filepath, Buffer.from(buffer));
                
                this.downloadedCount++;
                this.downloadedBytes += bytes;
                
                // 更新速度统计
                this.updateSpeedStats(bytes);
                
                const progress = {
                    current: this.downloadedCount,
                    total: this.segments.length,
                    percentage: Math.min(100, Math.round((this.downloadedCount / this.segments.length) * 100)),
                    segment: segment,
                    filename: filename,
                    filepath: filepath,
                    activeDownloads: this.activeDownloads,
                    currentSpeed: this.formatSpeed(this.currentSpeed),
                    averageSpeed: this.formatSpeed(this.averageSpeed),
                    downloadedBytes: this.formatBytes(this.downloadedBytes),
                    bytes: this.formatBytes(bytes),
                    retryCount: this.retryCount,
                    skipped: false
                };
                
                this.emit('progress', progress);
                
                // 每下载10个片段保存一次状态
                if (this.downloadedCount % 10 === 0) {
                    this.saveDownloadState();
                }
                
                return; // 成功下载，退出重试循环
                
            } catch (error) {
                console.error(`下载片段 ${index + 1} 失败 (尝试 ${attempt + 1}/${this.maxRetries + 1}):`, error.message);
                
                if (attempt < this.maxRetries) {
                    this.retryCount++;
                    // 使用指数退避策略，每次重试延迟时间增加
                    const exponentialDelay = this.retryDelay * Math.pow(2, attempt);
                    const jitter = Math.floor(Math.random() * 1000); // 添加随机抖动防止请求雪崩
                    const delayWithJitter = exponentialDelay + jitter;
                    
                    this.log(`${delayWithJitter}ms后重试...`);
                    await this.sleep(delayWithJitter);
                    
                    // 将任务重新加入队列末尾
                    task.retryCount = (task.retryCount || 0) + 1;
                    this.downloadQueue.push(task);
                    return; // 重新加入队列，让其他worker处理
                } else {
                    // 达到当前方法的最大重试次数，但总重试次数还没达到单个片段最大重试次数
                    if ((task.retryCount || 0) < this.maxSegmentRetries) {
                        task.retryCount = (task.retryCount || 0) + 1;
                        this.downloadQueue.push(task);
                        this.log(`片段 ${index + 1} 将再次进入下载队列，总重试次数: ${task.retryCount}/${this.maxSegmentRetries}`);
                        return;
                    } else {
                        // 达到最大重试次数，标记为失败
                        this.failedCount++;
                        this.emit('error', { index, error, url, retryCount: task.retryCount });
                    }
                }
            }
        }
    }
    
    updateSpeedStats(bytes) {
        const now = Date.now();
        const timeDiff = now - this.lastSpeedUpdate;
        
        if (timeDiff >= this.speedUpdateInterval) {
            // 计算这段时间内的下载字节数
            const bytesDiff = this.downloadedBytes - this.lastBytes;
            
            // 计算当前速度 (bytes per second)
            if (timeDiff > 0) {
                this.currentSpeed = (bytesDiff / timeDiff) * 1000;
            }
            
            // 添加到速度窗口
            this.speedWindow.push(this.currentSpeed);
            
            // 保持窗口大小
            if (this.speedWindow.length > this.windowSize) {
                this.speedWindow.shift();
            }
            
            // 计算平均速度
            if (this.speedWindow.length > 0) {
                this.averageSpeed = this.speedWindow.reduce((sum, speed) => sum + speed, 0) / this.speedWindow.length;
            }
            
            // 更新记录
            this.lastBytes = this.downloadedBytes;
            this.lastSpeedUpdate = now;
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    resolveSegmentUrl(segmentUri) {
        const baseUrl = new URL(this.playlistUrl);
        return new URL(segmentUri, baseUrl).toString();
    }
    
    // 格式化速度显示
    formatSpeed(bytesPerSecond) {
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        let speed = bytesPerSecond;
        let unitIndex = 0;
        
        while (speed >= 1024 && unitIndex < units.length - 1) {
            speed /= 1024;
            unitIndex++;
        }
        
        return `${speed.toFixed(2)} ${units[unitIndex]}`;
    }
    
    // 使用 fluent-ffmpeg 合并所有片段为一个指定格式的视频
    async mergeSegmentsWithFFmpeg(outputFile = null, outputFormat = 'mp4', options = {}, cleanupTemp = true) {
        if (!outputFile) {
            outputFile = path.join(this.outputDir, `${this.filename}.${outputFormat}`);
        }
        // 记录合并开始时间
        this.mergeStartTime = Date.now();
        
        // 收集所有存在的片段文件
        const segmentFiles = [];
        for (let i = 0; i < this.segments.length; i++) {
            const filename = `segment_${String(i).padStart(6, '0')}.ts`;
            const filepath = path.join(this.tempSegmentsDir, filename);
            
            if (fs.existsSync(filepath)) {
                segmentFiles.push(filepath);
            } else {
                console.warn(`Segment file not found: ${filepath}`);
            }
        }
        
        if (segmentFiles.length === 0) {
            throw new Error('No segments found to merge');
        }
        
        // 创建片段列表文件
        const segmentListFile = path.join(this.tempSegmentsDir, 'segments.txt');
        const segmentList = [];
        
        // 写入片段列表文件，使用绝对路径
        for (const filepath of segmentFiles) {
            // 使用绝对路径，避免路径问题
            const absolutePath = path.resolve(filepath);
            // 使用单引号包围路径，避免路径中的特殊字符问题
            segmentList.push(`file '${absolutePath}'`);
        }
        fs.writeFileSync(segmentListFile, segmentList.join('\n'), 'utf8');

        if (segmentList.length > 3) {
            this.log(`... (total ${segmentList.length} segments)`);
        }
        
        return new Promise((resolve, reject) => {
            // 创建 fluent-ffmpeg 实例
            let command = ffmpeg();
            
            // 使用 concat demuxer 输入片段列表文件（使用绝对路径）
            const absoluteSegmentListFile = path.resolve(segmentListFile);
            command = command.input(absoluteSegmentListFile);
            
            // 设置输出格式
            command = command.format(outputFormat);
            
            // 应用编码选项
            this.applyFFmpegOptions(command, outputFormat, options);
            
            // 设置输出文件（使用绝对路径）
            const absoluteOutputPath = path.resolve(outputFile);
            command = command.output(absoluteOutputPath);
            
            // 覆盖现有文件
            command = command.outputOptions('-y');
            
            // 监听进度
            command.on('progress', (progress) => {
                if (progress.percent) {
                    let percent = Math.min(100, progress.percent);
                    this.log(`⏱️ FFmpeg 进度: ${percent.toFixed(1)}% - 时间: ${progress.timemark}`);
                }
            });
            
            // 监听开始
            command.on('start', (commandLine) => {
                this.log(`执行命令: ${commandLine}`);
            });
            
            // 监听错误
            command.on('error', (err) => {
                this.emit('merged-error', `FFmpeg 合并失败: ${err.message}`)
                reject(err);
            });
            
            // 监听完成
            command.on('end', async () => {
                this.emit('merged-end', `FFmpeg Merged success: ${absoluteOutputPath}`);
                
                try {
                    // 获取输出文件信息
                    const stats = fs.statSync(absoluteOutputPath);
                    const fileSize = this.formatBytes(stats.size);
                    
                    this.log(`📁 输出文件大小: ${fileSize}`);
                    
                    const result = {
                        outputFile: absoluteOutputPath,
                        fileSize: stats.size,
                        formattedSize: fileSize,
                        mergeElapsed: this.mergeStartTime ? (Date.now() - this.mergeStartTime) / 1000 : 0
                    };
                    
                    // 如果需要清理临时文件
                    if (cleanupTemp) {
                        await this.cleanupTempSegments();
                    }
                    // 合并完成
                    this.emit('merged', result);
                    resolve(result);
                } catch (error) {
                    this.emit('merged-error', `无法获取输出文件信息: ${error.message}`)
                    reject(new Error(`无法获取输出文件信息: ${error.message}`));
                }
            });
            
            // 开始处理
            command.run();
        });
    }
    
    // 应用 fluent-ffmpeg 选项
    applyFFmpegOptions(command, outputFormat, options) {
        // 设置 concat demuxer 格式
        command.inputOptions(['-f', 'concat', '-safe', '0']);
        
        // 默认使用流复制（最快，不重新编码）
        let useStreamCopy = true;
        
        // 如果指定了编码选项，则不使用流复制
        if (options.videoCodec || options.audioCodec || options.videoBitrate || 
            options.audioBitrate || options.customArgs) {
            useStreamCopy = false;
        }
        
        if (useStreamCopy) {
            // 使用流复制，最快的合并方式
            command.outputOptions(['-c', 'copy']);
        } else {
            // 应用具体的编码选项
            if (options.videoCodec) {
                command.videoCodec(options.videoCodec);
            }
            
            if (options.audioCodec) {
                command.audioCodec(options.audioCodec);
            }
            
            if (options.videoBitrate) {
                command.videoBitrate(options.videoBitrate);
            }
            
            if (options.audioBitrate) {
                command.audioBitrate(options.audioBitrate);
            }
            
            // 设置视频滤镜
            if (options.videoFilters) {
                command.videoFilters(options.videoFilters);
            }
            
            // 设置帧率
            if (options.fps) {
                command.fps(options.fps);
            }
            
            // 设置分辨率
            if (options.size) {
                command.size(options.size);
            }
            
            // 设置宽高比
            if (options.aspect) {
                command.aspect(options.aspect);
            }
            
            // 添加自定义输出选项
            if (options.customArgs && Array.isArray(options.customArgs)) {
                command.outputOptions(options.customArgs);
            }
        }
        
        // 根据输出格式设置特殊选项
        switch (outputFormat.toLowerCase()) {
            case 'mp4':
                command.outputOptions(['-movflags', '+faststart']); // 优化 MP4 用于流媒体
                break;
            case 'webm':
                command.outputOptions(['-deadline', 'good', '-cpu-used', '0']);
                break;
        }
        
        return command;
    }
    
    // 格式化文件大小
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
    
    // 清理临时片段文件
    async cleanupTempSegments() {
        try {
            if (fs.existsSync(this.tempSegmentsDir)) {
                const files = fs.readdirSync(this.tempSegmentsDir);
                let deletedCount = 0;
                
                for (const file of files) {
                    const filePath = path.join(this.tempSegmentsDir, file);
                    if (file.endsWith('.ts')) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
                
                // 如果目录为空，删除目录
                const remainingFiles = fs.readdirSync(this.tempSegmentsDir);
                if (remainingFiles.length === 0) {
                    fs.rmdirSync(this.tempSegmentsDir);
                    this.log(`🗑️ 已清理临时片段目录: ${this.tempSegmentsDir}`);
                } else {
                    this.log(`🗑️ 已清理 ${deletedCount} 个临时片段文件`);
                }
                // 新增：清理状态文件
                await this.cleanupDownloadState();
                return deletedCount;
            }
        } catch (error) {
            console.warn(`⚠️ 清理临时文件时出错: ${error.message}`);
            return 0;
        }
    }
    
    // 清理下载状态文件
    cleanupDownloadState() {
        try {
            if (fs.existsSync(this.downloadStateFile)) {
                fs.unlinkSync(this.downloadStateFile);
                this.log(`🗑️ 已清理下载状态文件: ${this.downloadStateFile}`);
                return true;
            }
        } catch (error) {
            console.warn(`⚠️ 清理下载状态文件时出错: ${error.message}`);
        }
        return false;
    }
    
    // 获取下载状态
    getDownloadStatus() {
        return {
            isPaused: this.isPaused,
            isResuming: this.isResuming,
            downloadedCount: this.downloadedCount,
            totalSegments: this.segments ? this.segments.length : 0,
            failedCount: this.failedCount,
            retryCount: this.retryCount,
            downloadedBytes: this.downloadedBytes,
            currentSpeed: this.currentSpeed,
            averageSpeed: this.averageSpeed,
            activeDownloads: this.activeDownloads,
            hasStateFile: fs.existsSync(this.downloadStateFile),
            skippedSegments: this.skippedSegments || [] // 新增: 返回跳过的片段列表
        };
    }

    // 合并所有片段为一个文件（原有的简单合并方法，保留向后兼容）
    async mergeSegments(outputFile = null, outputFormat = 'mp4', cleanupTemp = false) {
        if (!outputFile) {
            outputFile =  path.join(this.outputDir, `${this.filename}.${outputFormat}`);
        }
        
        this.log('开始合并片段...');
        const segmentFiles = [];
        
        for (let i = 0; i < this.segments.length; i++) {
            const filename = `segment_${String(i).padStart(6, '0')}.ts`;
            const filepath = path.join(this.tempSegmentsDir, filename);
            
            if (fs.existsSync(filepath)) {
                segmentFiles.push(filepath);
            } else {
                console.warn(`片段文件不存在: ${filepath}`);
            }
        }
        
        if (segmentFiles.length === 0) {
            throw new Error('没有找到可合并的片段文件');
        }
        
        // 合并文件
        const writeStream = fs.createWriteStream(outputFile);
        
        for (const segmentFile of segmentFiles) {
            const segmentData = fs.readFileSync(segmentFile);
            writeStream.write(segmentData);
        }
        
        writeStream.end();
        
        return new Promise((resolve, reject) => {
            writeStream.on('finish', async () => {
                this.log(`合并完成: ${outputFile}`);
                
                // 如果需要清理临时文件
                if (cleanupTemp) {
                    await this.cleanupTempSegments();
                }
                
                resolve(outputFile);
            });
            writeStream.on('error', reject);
        });
    }

    // 保存下载状态
    saveDownloadState() {
        try {
            const state = {
                url: this.url,
                totalSegments: this.segments ? this.segments.length : 0,
                downloadedCount: this.downloadedCount,
                failedCount: this.failedCount,
                retryCount: this.retryCount,
                downloadedBytes: this.downloadedBytes,
                startTime: this.startTime,
                lastSpeedUpdate: this.lastSpeedUpdate,
                lastBytes: this.lastBytes,
                currentSpeed: this.currentSpeed,
                averageSpeed: this.averageSpeed,
                timestamp: Date.now()
            };
            
            // 确保输出目录存在
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
            }
            
            fs.writeFileSync(this.downloadStateFile, JSON.stringify(state, null, 2), 'utf8');
            this.log(`下载状态已保存: ${this.downloadStateFile}`);
        } catch (error) {
            console.warn(`保存下载状态失败: ${error.message}`);
        }
    }
    
    // 加载下载状态
    loadDownloadState() {
        try {
            if (fs.existsSync(this.downloadStateFile)) {
                const stateData = fs.readFileSync(this.downloadStateFile, 'utf8');
                const state = JSON.parse(stateData);
                
                // 检查是否是同一个 URL
                if (state.url === this.url) {
                    this.downloadedCount = state.downloadedCount || 0;
                    this.failedCount = state.failedCount || 0;
                    this.retryCount = state.retryCount || 0;
                    this.downloadedBytes = state.downloadedBytes || 0;
                    this.startTime = state.startTime || null;
                    this.lastSpeedUpdate = state.lastSpeedUpdate || 0;
                    this.lastBytes = state.lastBytes || 0;
                    this.currentSpeed = state.currentSpeed || 0;
                    this.averageSpeed = state.averageSpeed || 0;
                    // 自动修正异常
                    if (this.segments && this.downloadedCount > this.segments.length) {
                        this.log('检测到下载状态异常，已下载片段数大于总片段数，自动修正。');
                        this.downloadedCount = this.segments.length;
                    }
                    this.log(`加载下载状态: 已下载 ${this.downloadedCount} 个片段`);
                    return true;
                } else {
                    this.log(`URL 不匹配，忽略旧的下载状态`);
                }
            }
        } catch (error) {
            console.warn(`加载下载状态失败: ${error.message}`);
        }
        return false;
    }
    
    // 检查已下载的片段
    checkDownloadedSegments() {
        const downloadedSegments = [];
        
        if (this.segments) {
            for (let i = 0; i < this.segments.length; i++) {
                const filename = `segment_${String(i).padStart(6, '0')}.ts`;
                const filepath = path.join(this.tempSegmentsDir, filename);
                
                if (fs.existsSync(filepath)) {
                    const stats = fs.statSync(filepath);
                    if (stats.size > 0) {
                        downloadedSegments.push(i);
                    }
                }
            }
        }
        
        this.log(`检查到 ${downloadedSegments.length} 个已下载的片段`);
        return downloadedSegments;
    }
    
    // 暂停下载
    pause() {
        if (!this.isPaused) {
            this.isPaused = true;
            this.saveDownloadState();
            this.emit('paused', {
                downloadedCount: this.downloadedCount,
                totalSegments: this.segments ? this.segments.length : 0,
                downloadedBytes: this.downloadedBytes
            });
        }
    }
    
    // 继续下载
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.isResuming = true;
            this.log('继续下载...');
            this.emit('resumed', {
                downloadedCount: this.downloadedCount,
                totalSegments: this.segments ? this.segments.length : 0,
                remainingSegments: this.segments ? this.segments.length - this.downloadedCount : 0
            });
            
            // 重新开始下载
            this.downloadSegmentsConcurrently();
        }
    }

    // 用于手动跳过指定片段的方法
    skipSegment(index) {
        // 查找下载队列中的任务
        const taskIndex = this.downloadQueue.findIndex(task => task.index === index);
        
        if (taskIndex !== -1) {
            // 从队列中移除任务
            const task = this.downloadQueue.splice(taskIndex, 1)[0];
            
            // 记录跳过的片段
            this.skippedSegments.push(task.index);
            
            // 创建空文件作为占位符
            const filename = `segment_${String(task.index).padStart(6, '0')}.ts`;
            const filepath = path.join(this.tempSegmentsDir, filename);
            fs.writeFileSync(filepath, Buffer.from([0]));
            
            this.failedCount++;
            this.downloadedCount++;
            
            this.emit('skip', { 
                index: task.index, 
                segment: task.segment, 
                filename,
                manual: true 
            });
            
            // 更新进度
            const progress = {
                current: this.downloadedCount,
                total: this.segments.length,
                percentage: Math.min(100, Math.round((this.downloadedCount / this.segments.length) * 100)),
                segment: task.segment,
                filename: filename,
                filepath: filepath,
                activeDownloads: this.activeDownloads,
                currentSpeed: this.formatSpeed(this.currentSpeed),
                averageSpeed: this.formatSpeed(this.averageSpeed),
                downloadedBytes: this.formatBytes(this.downloadedBytes),
                bytes: this.formatBytes(0),
                retryCount: this.retryCount,
                skipped: true,
                manual: true
            };
            
            this.emit('progress', progress);
            
            return true;
        }
        
        return false;
    }
}

module.exports = M3U8Downloader;