/**
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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
 **/

import { putObject, getObject, listByPrefix, objectExists, statObject, getStream } from '@/utilities/buckets';
import { SYS_BUCKETS } from '@/config/minio';
import * as zlib from 'node:zlib';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { promisify } from 'node:util';
import { Readable } from 'stream';
import logger from '@/logger';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Service for managing compressed LAMMPS dump files in MinIO.
 * Dumps are stored with gzip compression to reduce storage costs.
 */
export default class DumpStorage {
    private static readonly COMPRESSION_LEVEL = 6; // Balanced compression/speed
    private static readonly CACHE_DIR = path.join(os.tmpdir(), 'opendxa-dumps-cache');

    /**
     * Get MinIO object name for a dump file
     */
    private static getObjectName(trajectoryId: string, timestep: string | number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
    }

    /**
     * Get cache file path for a decompressed dump
     */
    private static getCachePath(trajectoryId: string, timestep: string | number): string {
        return path.join(this.CACHE_DIR, trajectoryId, `${timestep}.dump`);
    }

    /**
     * Ensure cache directory exists
     */
    private static async ensureCacheDir(): Promise<void> {
        try {
            await fs.mkdir(this.CACHE_DIR, { recursive: true });
        } catch (err) {
            logger.warn(`Failed to create cache directory: ${err}`);
        }
    }

    /**
     * Save a dump file to MinIO with compression
     * @param trajectoryId Trajectory ID
     * @param timestep Timestep number
     * @param data Buffer or string containing the dump data
     * @returns Promise resolving to the MinIO object name
     */
    static async saveDump(
        trajectoryId: string,
        timestep: string | number,
        data: Buffer | string
    ): Promise<string> {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
        const compressed = await gzip(buffer, { level: this.COMPRESSION_LEVEL });
        const objectName = this.getObjectName(trajectoryId, timestep);

        await putObject(objectName, SYS_BUCKETS.DUMPS, compressed, {
            'Content-Type': 'application/gzip',
            'Content-Encoding': 'gzip'
        });

        logger.info(`Saved compressed dump: ${objectName} (${buffer.length} -> ${compressed.length} bytes, ${Math.round((1 - compressed.length / buffer.length) * 100)}% reduction)`);
        return objectName;
    }

    /**
     * Get a dump file as a local file path (decompresses and caches)
     * @param trajectoryId Trajectory ID
     * @param timestep Timestep number
     * @returns Promise resolving to local file path, or null if not found
     */
    static async getDump(trajectoryId: string, timestep: string | number): Promise<string | null> {
        const objectName = this.getObjectName(trajectoryId, timestep);
        const cachePath = this.getCachePath(trajectoryId, timestep);

        // Check cache first
        try {
            await fs.access(cachePath);
            logger.info(`Using cached dump: ${cachePath}`);
            return cachePath;
        } catch {
            // Not in cache, download and decompress
        }

        try {
            const exists = await objectExists(objectName, SYS_BUCKETS.DUMPS);
            if (!exists) {
                return null;
            }

            const compressed = await getObject(objectName, SYS_BUCKETS.DUMPS);
            const decompressed = await gunzip(compressed);

            // Save to cache
            await this.ensureCacheDir();
            const cacheDir = path.dirname(cachePath);
            await fs.mkdir(cacheDir, { recursive: true });
            await fs.writeFile(cachePath, decompressed);

            logger.info(`Decompressed dump to cache: ${cachePath}`);
            return cachePath;
        } catch (err) {
            logger.error(`Failed to get dump ${objectName}: ${err}`);
            return null;
        }
    }

    /**
     * Get a dump file as a readable stream (decompressed on-the-fly)
     * @param trajectoryId Trajectory ID
     * @param timestep Timestep number
     * @returns Promise resolving to a readable stream
     */
    static async getDumpStream(trajectoryId: string, timestep: string | number): Promise<Readable> {
        const objectName = this.getObjectName(trajectoryId, timestep);
        const stream = await getStream(objectName, SYS_BUCKETS.DUMPS);
        const gunzipStream = zlib.createGunzip();
        return stream.pipe(gunzipStream);
    }

    /**
     * Check if a dump exists
     * @param trajectoryId Trajectory ID
     * @param timestep Timestep number
     * @returns Promise resolving to true if dump exists
     */
    static async exists(trajectoryId: string, timestep: string | number): Promise<boolean> {
        const objectName = this.getObjectName(trajectoryId, timestep);
        return await objectExists(objectName, SYS_BUCKETS.DUMPS);
    }

    /**
     * List all dumps for a trajectory
     * @param trajectoryId Trajectory ID
     * @returns Promise resolving to array of timesteps
     */
    static async listDumps(trajectoryId: string): Promise<string[]> {
        const prefix = `trajectory-${trajectoryId}/`;
        const objectNames = await listByPrefix(prefix, SYS_BUCKETS.DUMPS);

        const timesteps: string[] = [];
        for (const name of objectNames) {
            const match = name.match(/timestep-(\d+)\.dump\.gz$/);
            if (match) {
                timesteps.push(match[1]);
            }
        }

        return timesteps.sort((a, b) => Number(a) - Number(b));
    }

    /**
     * Calculate total storage size for dumps of a trajectory
     * @param trajectoryId Trajectory ID
     * @returns Promise resolving to total size in bytes
     */
    static async calculateSize(trajectoryId: string): Promise<number> {
        const prefix = `trajectory-${trajectoryId}/`;
        const objectNames = await listByPrefix(prefix, SYS_BUCKETS.DUMPS);

        let totalSize = 0;
        for (const name of objectNames) {
            try {
                const stat = await statObject(name, SYS_BUCKETS.DUMPS);
                totalSize += stat.size;
            } catch (err) {
                logger.warn(`Failed to get size for ${name}: ${err}`);
            }
        }

        return totalSize;
    }

    /**
     * Delete all dumps for a trajectory
     * @param trajectoryId Trajectory ID
     */
    static async deleteDumps(trajectoryId: string): Promise<void> {
        const { deleteByPrefix } = await import('@/utilities/buckets');
        const prefix = `trajectory-${trajectoryId}/`;
        await deleteByPrefix(SYS_BUCKETS.DUMPS, prefix);

        // Clean up cache
        const cacheDir = path.join(this.CACHE_DIR, trajectoryId);
        try {
            await fs.rm(cacheDir, { recursive: true, force: true });
            logger.info(`Cleaned up cache for trajectory ${trajectoryId}`);
        } catch (err) {
            logger.warn(`Failed to clean cache for trajectory ${trajectoryId}: ${err}`);
        }
    }

    /**
     * Clear the entire cache directory
     */
    static async clearCache(): Promise<void> {
        try {
            await fs.rm(this.CACHE_DIR, { recursive: true, force: true });
            await this.ensureCacheDir();
            logger.info('Cleared dump cache');
        } catch (err) {
            logger.warn(`Failed to clear cache: ${err}`);
        }
    }
}
