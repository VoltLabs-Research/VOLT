/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { SYS_BUCKETS } from '@/config/minio';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import storage from '@/services/storage';
import logger from '@/logger';
import pLimit from '@/utilities/perf/p-limit';
import * as zlib from 'node:zlib';
import * as fs from 'node:fs/promises';
import * as fsNative from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

type DumpInput = Buffer | string;

export default class DumpStorage {
    private static readonly COMPRESSION_LEVEL = zlib.constants.Z_BEST_SPEED;
    private static readonly CACHE_DIR = path.join(os.tmpdir(), 'volterra-dumps-cache');
    private static readonly TEMP_DIR = path.join(os.tmpdir(), 'volterra-temp-uploads');
    private static readonly CACHE_TTL_MS = 30 * 60 * 1000;
    private static readonly RAM_THRESHOLD = 4 * 1024 * 1024;
    private static pendingRequests = new Map<string, Promise<string | null>>();
    private static storageLimit = pLimit(50);

    private static async ensureDirs(): Promise<void> {
        await Promise.all([
            fs.mkdir(this.CACHE_DIR, { recursive: true }),
            fs.mkdir(this.TEMP_DIR, { recursive: true })
        ]);
    }

    private static getObjectName(trajectoryId: string, timestep: string | number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
    }

    private static getCachePath(trajectoryId: string, timestep: string | number): string {
        return path.join(this.CACHE_DIR, trajectoryId, `${timestep}.dump`);
    }

    static async saveDump(
        trajectoryId: string,
        timestep: string | number,
        data: DumpInput,
        onProgress?: (progress: number) => void
    ): Promise<string> {
        const objectName = this.getObjectName(trajectoryId, timestep);
        const startTime = Date.now();

        try {
            // Small Buffer -> Compress in RAM -> Upload
            if (Buffer.isBuffer(data) && data.length <= this.RAM_THRESHOLD) {
                const compressed = zlib.gzipSync(data, { level: this.COMPRESSION_LEVEL });
                await storage.put(SYS_BUCKETS.DUMPS, objectName, compressed, {
                    'Content-Type': 'application/gzip',
                    'Content-Encoding': 'gzip'
                });
                this.logMetrics(objectName, data.length, compressed.length, startTime);
                return objectName;
            }

            // Large Buffer of File Path -> Stream to Temp File -> Upload -> Delete Temp
            // We use a temp file to calculate exact size and avoid buffering large streams in RAM.
            await this.ensureDirs();
            const tempFilePath = path.join(this.TEMP_DIR, `${randomUUID()}.gz`);
            let inputSize = 0;

            const sourceStream = typeof data === 'string'
                ? fsNative.createReadStream(data)
                : Readable.from(data);

            // Measure input size while streaming
            let processedBytes = 0;
            sourceStream.on('data', (chunk: DumpInput) => {
                inputSize += chunk.length;
                processedBytes += chunk.length;
                // We don't know total size for stream/buffer easily here unless passed?
                // For file path we can stat it.
            });

            let totalSize = 0;
            if (typeof data === 'string') {
                try {
                    totalSize = (await fs.stat(data)).size;
                } catch { }
            } else if (Buffer.isBuffer(data)) {
                totalSize = data.length;
            }

            if (onProgress && totalSize > 0) {
                sourceStream.on('data', () => {
                    const p = Math.min(1, processedBytes / totalSize);
                    onProgress(p);
                });
            } else {
                logger.warn(`[DumpStorage] Cannot track progress. TotalSize: ${totalSize}`);
            }

            const gzip = zlib.createGzip({ level: this.COMPRESSION_LEVEL });
            const dest = fsNative.createWriteStream(tempFilePath);

            // Compress to disk
            await pipeline(sourceStream, gzip, dest);

            // Upload the compressed file
            const stats = await fs.stat(tempFilePath);
            const uploadStream = fsNative.createReadStream(tempFilePath);
            await storage.put(SYS_BUCKETS.DUMPS, objectName, uploadStream, {
                'Content-Type': 'application/gzip',
                'Content-Encoding': 'gzip',
                'Content-Length': stats.size
            });
            this.logMetrics(objectName, inputSize, stats.size, startTime);

            // Cleanup
            await fs.unlink(tempFilePath).catch(() => { });
            return objectName;
        } catch (error) {
            logger.error(`Failed to save dump ${objectName}: ${error}`);
            throw error;
        }
    }

    /**
     * Retrieving with Thundering Herd Protection.
     * If 10 requests come for the same file, only 1 download triggers.
     */
    static async getDump(trajectoryId: string, timestep: string | number): Promise<string | null> {
        const objectName = this.getObjectName(trajectoryId, timestep);
        const cachePath = this.getCachePath(trajectoryId, timestep);
        const cacheKey = `${trajectoryId}:${timestep}`;

        // Check valid cache on disk
        if (await this.isCacheValid(cachePath)) {
            // Update access time(LRU behavior)
            fs.utimes(cachePath, new Date(), new Date()).catch(() => { });
            return cachePath;
        }

        // Check if already downloading(promise locking)
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey)!;
        }

        // Start new download/decompression
        const downloadTask = this.executeDownload(objectName, cachePath, cacheKey);
        this.pendingRequests.set(cacheKey, downloadTask);
        return downloadTask;
    }

    private static async executeDownload(
        objectName: string,
        cachePath: string,
        cacheKey: string
    ): Promise<string | null> {
        try {
            const exists = await storage.exists(SYS_BUCKETS.DUMPS, objectName);
            if (!exists) return null;

            await this.ensureDirs();
            const cacheDir = path.dirname(cachePath);
            await fs.mkdir(cacheDir, { recursive: true });

            const startTime = Date.now();
            const remoteStream = await storage.getStream(SYS_BUCKETS.DUMPS, objectName);
            const gunzip = zlib.createGunzip();
            const fileWriter = fsNative.createWriteStream(cachePath);

            // Stream Pipeline: Remote -> Decompress -> Disk
            await pipeline(remoteStream, gunzip, fileWriter);
            logger.info(`Downloaded & Decompressed ${objectName} in ${Date.now() - startTime}ms`);
            return cachePath;
        } catch (err) {
            // If failed, delete partial file
            await fs.unlink(cachePath).catch(() => { });
            logger.error(`Error processing ${objectName}: ${err}`);
            return null;
        } finally {
            // Unlock
            this.pendingRequests.delete(cacheKey);
        }
    }

    static async calculateSize(trajectoryId: string): Promise<number> {
        const prefix = `trajectory-${trajectoryId}/`;
        let totalSize = 0;

        const pendingTasks: Promise<number>[] = [];
        const BATCH_SIZE = 50;

        for await (const key of storage.listByPrefix(SYS_BUCKETS.DUMPS, prefix)) {
            if (!key.endsWith('.dump.gz')) continue;

            const task = this.storageLimit(async () => {
                try {
                    const stat = await storage.getStat(SYS_BUCKETS.DUMPS, key);
                    return stat.size;
                } catch (e) {
                    return 0;
                }
            });

            pendingTasks.push(task);

            if (pendingTasks.length >= BATCH_SIZE) {
                const results = await Promise.all(pendingTasks);
                totalSize += results.reduce((acc, size) => acc + size, 0);
                pendingTasks.length = 0;
            }
        }

        if (pendingTasks.length > 0) {
            const results = await Promise.all(pendingTasks);
            totalSize += results.reduce((acc, size) => acc + size, 0);
        }

        return totalSize;
    }

    static async getDumpStream(trajectoryId: string, timestep: string | number): Promise<Readable> {
        const objectName = this.getObjectName(trajectoryId, timestep);
        const rawStream = await storage.getStream(SYS_BUCKETS.DUMPS, objectName);
        return rawStream.pipe(zlib.createGunzip());
    }

    static async listDumps(trajectoryId: string): Promise<string[]> {
        const prefix = `trajectory-${trajectoryId}/`;
        const timesteps: string[] = [];

        for await (const name of storage.listByPrefix(SYS_BUCKETS.DUMPS, prefix)) {
            const match = name.match(/timestep-(\d+)\.dump\.gz$/);
            if (match) {
                timesteps.push(match[1]);
            }
        }

        return timesteps.sort((a, b) => Number(a) - Number(b));
    }

    static async deleteDumps(trajectoryId: string): Promise<void> {
        const prefix = `trajectory-${trajectoryId}/`;
        await Promise.all([
            storage.deleteByPrefix(SYS_BUCKETS.DUMPS, prefix),
            fs.rm(path.join(this.CACHE_DIR, trajectoryId), { recursive: true, force: true })
        ]);
        logger.info(`Deleted dumps for trajectory ${trajectoryId}`);
    }

    private static async isCacheValid(filePath: string): Promise<boolean> {
        try {
            const stats = await fs.stat(filePath);
            return (Date.now() - stats.mtimeMs) < this.CACHE_TTL_MS;
        } catch {
            return false;
        }
    }

    private static logMetrics(name: string, original: number, compressed: number, start: number) {
        const duration = Date.now() - start;
        const ratio = original > 0 ? ((1 - compressed / original) * 100).toFixed(1) : '0';
        logger.info(`Saved ${name} | Size: ${original} -> ${compressed} (${ratio}%) | Time: ${duration}ms`);
    }

    static async pruneCache(): Promise<void> {
        try {
            await fs.rm(this.CACHE_DIR, { recursive: true, force: true });
            await fs.rm(this.TEMP_DIR, { recursive: true, force: true });
            logger.info('Dump cache pruned');
        } catch (error) {
            logger.warn(`Cache prune failed: ${error}`);
        }
    }
};
