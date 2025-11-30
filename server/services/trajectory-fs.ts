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

import logger from '@/logger';
import { listByPrefix, statObject, getStream } from '@/utilities/buckets';
import { SYS_BUCKETS } from '@/config/minio';
import { Trajectory, Analysis } from '@/models';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { Readable } from 'stream';
import mime from 'mime-types';
import RuntimeError from '@/utilities/runtime-error';
import DumpStorage from '@/services/dump-storage';

export type EntryType = 'file' | 'dir';

export interface FsEntry {
    type: EntryType;
    name: string;
    relPath: string;
    size?: number;
    mtime?: string;
    ext?: string | null;
    mime?: string | false;
}

export type Media = 'raster' | 'glb' | 'both';

export interface MediaMaps {
    raster?: Record<string, string>;
    glb?: Record<string, string>;
}

export interface PreviewsResult extends MediaMaps {
    previewPng?: string | null;
}

export interface GetOptions {
    media?: Media;
}

class TrajectoryFS {
    readonly userId: string | null;
    readonly baseDir: string;

    constructor(
        userId: string | null = null,
        baseDir = process.env.TRAJECTORY_DIR || path.join(os.tmpdir(), 'opendxa-trajectories')
    ) {
        if (!baseDir) {
            throw new Error('TRAJECTORY_DIR is not defined.')
        }
        this.userId = userId;
        this.baseDir = path.resolve(baseDir);
    }

    /**
     * Lists contents of a virtual path.
     * Path should be relative to the virtual root.
     */
    async list(virtualPath: string = ''): Promise<FsEntry[]> {
        const cleanPath = virtualPath.replace(/^\/+/, '').replace(/\/+$/, '');
        const parts = cleanPath ? cleanPath.split('/') : [];

        // Root: list user's trajectories
        if (parts.length === 0) {
            return this.listUserTrajectories();
        }

        const trajectoryDir = parts[0];
        const trajectoryId = trajectoryDir.replace(/^trajectory-/, '');

        // trajectory-{id}/
        if (parts.length === 1) {
            return this.listTrajectoryRoot(trajectoryId);
        }

        const subDir = parts[1];

        // trajectory-{id}/dumps/
        if (subDir === 'dumps') {
            return this.listDumps(trajectoryId, parts.slice(2).join('/'));
        }

        // trajectory-{id}/raster/
        if (subDir === 'raster') {
            return this.listRaster(trajectoryId, parts.slice(2).join('/'));
        }

        // trajectory-{id}/analysis-{id}/
        if (subDir.startsWith('analysis-')) {
            const analysisId = subDir.replace(/^analysis-/, '');
            return this.listAnalysis(trajectoryId, analysisId, parts.slice(2).join('/'));
        }

        throw new RuntimeError('PathNotFound', 404);
    }

    /**
     * Gets a read stream for a file.
     */
    async getReadStream(virtualPath: string): Promise<{ stream: Readable; size: number; contentType: string; filename: string }> {
        const cleanPath = virtualPath.replace(/^\/+/, '').replace(/\/+$/, '');
        const parts = cleanPath.split('/');

        if (parts.length < 2) {
            throw new RuntimeError('InvalidPath', 400);
        }

        const trajectoryId = parts[0].replace(/^trajectory-/, '');
        const subDir = parts[1];

        if (subDir === 'dumps') {
            return this.getDumpStream(trajectoryId, parts.slice(2).join('/'));
        }

        if (subDir === 'raster') {
            return this.getRasterStream(trajectoryId, parts.slice(2).join('/'));
        }

        if (subDir.startsWith('analysis-')) {
            const analysisId = subDir.replace(/^analysis-/, '');
            return this.getAnalysisStream(trajectoryId, analysisId, parts.slice(2).join('/'));
        }

        throw new RuntimeError('FileNotFound', 404);
    }

    // --- User Trajectories ---

    private async listUserTrajectories(): Promise<FsEntry[]> {
        if (!this.userId) {
            throw new RuntimeError('Unauthorized', 401);
        }

        try {
            const trajectories = await Trajectory.find({ createdBy: this.userId })
                .select('_id name updatedAt')
                .lean();

            const results = await Promise.all(trajectories.map(async (traj: any) => {
                const trajectoryId = traj._id.toString();

                // Calculate total size: dumps + raster + all analyses
                const dumpsSize = await DumpStorage.calculateSize(trajectoryId);
                const rasterSize = await this.calculateMinioSize(`trajectory-${trajectoryId}/previews/`, SYS_BUCKETS.RASTERIZER);

                // Get all analyses for this trajectory
                const analyses = await Analysis.find({ trajectory: trajectoryId }).select('_id').lean();
                let analysesSize = 0;
                for (const analysis of analyses) {
                    const analysisId = analysis._id.toString();
                    const glbSize = await this.calculateMinioSize(`${trajectoryId}/${analysisId}/glb/`, SYS_BUCKETS.MODELS);
                    const dataSize = await this.calculateMinioSize(`${trajectoryId}/${analysisId}/data/`, SYS_BUCKETS.MODELS);
                    analysesSize += glbSize + dataSize;
                }

                return {
                    type: 'dir' as EntryType,
                    name: `trajectory-${trajectoryId}`,
                    relPath: `trajectory-${trajectoryId}`,
                    size: dumpsSize + rasterSize + analysesSize,
                    mtime: traj.updatedAt?.toISOString() || new Date().toISOString()
                };
            }));

            return results;
        } catch (err) {
            logger.error(`Failed to list user trajectories: ${err}`);
            return [];
        }
    }

    // --- Trajectory Root ---

    private async listTrajectoryRoot(trajectoryId: string): Promise<FsEntry[]> {
        const entries: FsEntry[] = [];

        // Calculate dumps directory size from MinIO
        const dumpsSize = await DumpStorage.calculateSize(trajectoryId);
        entries.push({
            type: 'dir',
            name: 'dumps',
            relPath: `trajectory-${trajectoryId}/dumps`,
            size: dumpsSize,
            mtime: new Date().toISOString()
        });

        // Calculate raster directory size
        const rasterSize = await this.calculateMinioSize(`trajectory-${trajectoryId}/previews/`, SYS_BUCKETS.RASTERIZER);
        entries.push({
            type: 'dir',
            name: 'raster',
            relPath: `trajectory-${trajectoryId}/raster`,
            size: rasterSize,
            mtime: new Date().toISOString()
        });

        // List analyses
        try {
            const analyses = await Analysis.find({ trajectory: trajectoryId })
                .select('_id name updatedAt')
                .lean();

            for (const analysis of analyses) {
                const analysisId = analysis._id.toString();
                const glbSize = await this.calculateMinioSize(`${trajectoryId}/${analysisId}/glb/`, SYS_BUCKETS.MODELS);
                const dataSize = await this.calculateMinioSize(`${trajectoryId}/${analysisId}/data/`, SYS_BUCKETS.MODELS);

                entries.push({
                    type: 'dir',
                    name: `analysis-${analysisId}`,
                    relPath: `trajectory-${trajectoryId}/analysis-${analysisId}`,
                    size: glbSize + dataSize,
                    mtime: (analysis as any).updatedAt?.toISOString() || new Date().toISOString()
                });
            }
        } catch (err) {
            logger.error(`Failed to list analyses: ${err}`);
        }

        return entries;
    }

    // Helper: Calculate size of local directory
    private async calculateLocalDirSize(dirPath: string): Promise<number> {
        try {
            const files = await fs.readdir(dirPath, { withFileTypes: true });
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(dirPath, file.name);
                if (file.isFile()) {
                    const stat = await fs.stat(filePath);
                    totalSize += stat.size;
                } else if (file.isDirectory()) {
                    totalSize += await this.calculateLocalDirSize(filePath);
                }
            }

            return totalSize;
        } catch (err) {
            return 0;
        }
    }

    // Helper: Calculate size of MinIO prefix
    private async calculateMinioSize(prefix: string, bucket: string): Promise<number> {
        try {
            const keys = await listByPrefix(prefix, bucket);
            let totalSize = 0;

            for (const key of keys) {
                const stat = await statObject(key, bucket);
                totalSize += stat.size;
            }

            return totalSize;
        } catch (err) {
            return 0;
        }
    }

    // --- Dumps ---

    private async listDumps(trajectoryId: string, subPath: string): Promise<FsEntry[]> {
        // Dumps are now stored flat in MinIO, no subdirectories
        if (subPath) {
            return []; // No subdirectories in MinIO dump storage
        }

        try {
            const timesteps = await DumpStorage.listDumps(trajectoryId);
            const entries: FsEntry[] = [];

            for (const timestep of timesteps) {
                const objectName = `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
                try {
                    const stat = await statObject(objectName, SYS_BUCKETS.DUMPS);
                    entries.push({
                        type: 'file',
                        name: timestep, // Just the timestep number as name
                        relPath: `trajectory-${trajectoryId}/dumps/${timestep}`,
                        size: stat.size,
                        mtime: stat.lastModified.toISOString(),
                        ext: '.dump.gz',
                        mime: 'application/gzip'
                    });
                } catch (err) {
                    logger.warn(`Failed to stat dump ${objectName}: ${err}`);
                }
            }

            return entries;
        } catch (err) {
            logger.error(`Failed to list dumps for trajectory ${trajectoryId}: ${err}`);
            return [];
        }
    }

    private async getDumpStream(trajectoryId: string, subPath: string) {
        // subPath is the timestep number
        const timestep = subPath;

        try {
            const stream = await DumpStorage.getDumpStream(trajectoryId, timestep);
            const objectName = `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
            const stat = await statObject(objectName, SYS_BUCKETS.DUMPS);

            return {
                stream,
                size: stat.size, // Compressed size
                contentType: 'text/plain', // Decompressed stream is plain text
                filename: timestep
            };
        } catch (err: any) {
            throw new RuntimeError('FileNotFound', 404);
        }
    }

    // --- Raster ---

    private async listRaster(trajectoryId: string, subPath: string): Promise<FsEntry[]> {
        // Raster images are stored as: trajectory-{id}/previews/timestep-{timestep}.png
        const prefix = subPath ? `trajectory-${trajectoryId}/previews/${subPath}` : `trajectory-${trajectoryId}/previews/`;
        return this.listMinioObjects(prefix, SYS_BUCKETS.RASTERIZER, `trajectory-${trajectoryId}/raster`, subPath);
    }

    private async getRasterStream(trajectoryId: string, subPath: string) {
        const objectName = subPath.startsWith('trajectory-') ? subPath : `trajectory-${trajectoryId}/previews/${subPath}`;
        return this.getMinioStream(objectName, SYS_BUCKETS.RASTERIZER);
    }

    // --- Analysis ---

    private async listAnalysis(trajectoryId: string, analysisId: string, subPath: string): Promise<FsEntry[]> {
        if (!subPath) {
            // Root of analysis: show glb/ and data/ directories
            const glbSize = await this.calculateMinioSize(`${trajectoryId}/${analysisId}/glb/`, SYS_BUCKETS.MODELS);
            const dataSize = await this.calculateMinioSize(`${trajectoryId}/${analysisId}/data/`, SYS_BUCKETS.MODELS);

            return [
                {
                    type: 'dir',
                    name: 'glb',
                    relPath: `trajectory-${trajectoryId}/analysis-${analysisId}/glb`,
                    size: glbSize,
                    mtime: new Date().toISOString()
                },
                {
                    type: 'dir',
                    name: 'data',
                    relPath: `trajectory-${trajectoryId}/analysis-${analysisId}/data`,
                    size: dataSize,
                    mtime: new Date().toISOString()
                }
            ];
        }

        const parts = subPath.split('/');
        const subDir = parts[0];

        if (subDir === 'glb') {
            return this.listAnalysisGLB(trajectoryId, analysisId, parts.slice(1).join('/'));
        }

        if (subDir === 'data') {
            return this.listAnalysisData(trajectoryId, analysisId, parts.slice(1).join('/'));
        }

        throw new RuntimeError('PathNotFound', 404);
    }

    private async listAnalysisGLB(trajectoryId: string, analysisId: string, subPath: string): Promise<FsEntry[]> {
        const prefix = subPath ? `${trajectoryId}/${analysisId}/glb/${subPath}/` : `${trajectoryId}/${analysisId}/glb/`;
        return this.listMinioObjects(prefix, SYS_BUCKETS.MODELS, `trajectory-${trajectoryId}/analysis-${analysisId}/glb`, subPath);
    }

    private async listAnalysisData(trajectoryId: string, analysisId: string, subPath: string): Promise<FsEntry[]> {
        const prefix = subPath ? `${trajectoryId}/${analysisId}/data/${subPath}/` : `${trajectoryId}/${analysisId}/data/`;
        return this.listMinioObjects(prefix, SYS_BUCKETS.MODELS, `trajectory-${trajectoryId}/analysis-${analysisId}/data`, subPath);
    }

    private async getAnalysisStream(trajectoryId: string, analysisId: string, subPath: string) {
        const parts = subPath.split('/');
        const subDir = parts[0];

        if (subDir === 'glb') {
            const objectName = `${trajectoryId}/${analysisId}/glb/${parts.slice(1).join('/')}`;
            return this.getMinioStream(objectName, SYS_BUCKETS.MODELS);
        }

        if (subDir === 'data') {
            const objectName = `${trajectoryId}/${analysisId}/data/${parts.slice(1).join('/')}`;
            return this.getMinioStream(objectName, SYS_BUCKETS.MODELS);
        }

        throw new RuntimeError('FileNotFound', 404);
    }

    // --- MinIO Helpers ---

    private async listMinioObjects(prefix: string, bucket: string, virtualBase: string, subPath: string): Promise<FsEntry[]> {
        try {
            const allKeys = await listByPrefix(prefix, bucket);
            const entries = new Map<string, FsEntry>();

            for (const key of allKeys) {
                const relToPrefix = key.substring(prefix.length);
                const parts = relToPrefix.split('/').filter(Boolean);

                if (parts.length === 0) continue;

                const name = parts[0];

                if (parts.length > 1) {
                    if (!entries.has(name)) {
                        entries.set(name, {
                            type: 'dir',
                            name: name,
                            relPath: path.join(virtualBase, subPath, name),
                            mtime: new Date().toISOString()
                        });
                    }
                } else {
                    const stat = await statObject(key, bucket);
                    const ext = path.extname(name);
                    entries.set(name, {
                        type: 'file',
                        name: name,
                        relPath: path.join(virtualBase, subPath, name),
                        size: stat.size,
                        mtime: stat.lastModified.toISOString(),
                        ext: ext,
                        mime: mime.lookup(ext) || 'application/octet-stream'
                    });
                }
            }

            return Array.from(entries.values());
        } catch (err) {
            logger.error(`MinIO list error: ${err}`);
            return [];
        }
    }

    private async getMinioStream(objectName: string, bucket: string) {
        try {
            const stat = await statObject(objectName, bucket);
            const stream = await getStream(objectName, bucket);
            return {
                stream,
                size: stat.size,
                contentType: mime.lookup(objectName) || 'application/octet-stream',
                filename: path.basename(objectName)
            };
        } catch (err) {
            throw new RuntimeError('FileNotFound', 404);
        }
    }

    // --- Compatibility Methods for Legacy Code ---

    /**
     * Get dump file path for a specific frame
     * @param trajectoryId Required for compatibility calls
     * @param frame Frame number or timestep
     */
    async getDump(trajectoryId: string, frame: string | number): Promise<string | null> {
        // Check filesystem first (for dumps being processed)
        const fsPath = path.join(this.baseDir, trajectoryId, 'dumps', String(frame));
        try {
            const stat = await fs.stat(fsPath);
            if (stat.isFile()) {
                return fsPath;
            }
        } catch {
            // Not in filesystem, check MinIO
        }

        // Fall back to MinIO (for migrated dumps)
        return await DumpStorage.getDump(trajectoryId, frame);
    }

    /**
     * Save dump file
     * @param trajectoryId Required trajectoryId
     * @param frame Frame number or timestep
     * @param bufferOrSrc Buffer or source path
     * @param overwrite Whether to overwrite existing file
     */
    async saveDump(trajectoryId: string, frame: string | number, bufferOrSrc: Buffer | string, overwrite = true): Promise<string> {
        // Save to filesystem first for worker processing compatibility
        const destDir = path.join(this.baseDir, trajectoryId, 'dumps');
        await fs.mkdir(destDir, { recursive: true });

        const dest = path.join(destDir, String(frame));

        if (!overwrite) {
            try {
                await fs.stat(dest);
                return dest; // File exists, don't overwrite
            } catch {
                // File doesn't exist, continue
            }
        }

        let data: Buffer;
        if (typeof bufferOrSrc === 'string') {
            data = await fs.readFile(bufferOrSrc);
        } else {
            data = bufferOrSrc;
        }

        await fs.writeFile(dest, data);
        return dest;
    }

    /**
     * Migrate a dump from filesystem to MinIO (for post-processing migration)
     * @param trajectoryId Trajectory ID
     * @param frame Frame number
     */
    async migrateDumpToMinIO(trajectoryId: string, frame: string | number): Promise<void> {
        const fsPath = path.join(this.baseDir, trajectoryId, 'dumps', String(frame));

        try {
            const data = await fs.readFile(fsPath);
            await DumpStorage.saveDump(trajectoryId, frame, data);

            // Delete from filesystem after successful upload
            await fs.unlink(fsPath);
            logger.info(`Migrated dump ${frame} to MinIO for trajectory ${trajectoryId}`);
        } catch (err) {
            logger.error(`Failed to migrate dump ${frame} for trajectory ${trajectoryId}: ${err}`);
            throw err;
        }
    }

    /**
     * Ensure directory structure exists for a trajectory
     * @param trajectoryId Required trajectoryId
     */
    async ensureStructure(trajectoryId: string): Promise<void> {
        const trajectoryRoot = path.join(this.baseDir, trajectoryId);
        const dumpsDir = path.join(trajectoryRoot, 'dumps');

        await fs.mkdir(trajectoryRoot, { recursive: true });
        await fs.mkdir(dumpsDir, { recursive: true });
    }

    /**
     * List raster analysis types for a specific frame
     * Note: This is a stub - raster data is now only in MinIO
     * @param trajectoryId Required trajectoryId
     * @param frame Frame number
     * @param analysisId Analysis ID
     */
    async listRasterAnalyses(trajectoryId: string, frame: number | string, analysisId: string): Promise<string[]> {
        // Raster images are now in MinIO under trajectory-{id}/analysis-{id}/raster/
        // For backward compatibility, return empty array as raster is handled differently now
        return [];
    }

    /**
     * Get analysis files (GLB or data)
     * @param trajectoryId Required trajectoryId
     * @param analysisId Analysis ID
     * @param analysisType Type of analysis  
     * @param options Media options
     */
    async getAnalysis(trajectoryId: string, analysisId: string, analysisType: string, options?: GetOptions): Promise<MediaMaps> {
        const { raster, glb: wantGlb } = this.want(options?.media);
        const result: MediaMaps = {};

        if (wantGlb) {
            // List GLB files from MinIO
            const prefix = `${trajectoryId}/${analysisId}/glb/`;
            try {
                const glbKeys = await listByPrefix(prefix, SYS_BUCKETS.MODELS);
                const frameMap: Record<string, string> = {};

                for (const key of glbKeys) {
                    const parts = key.split('/');
                    if (parts.length >= 5) {
                        const frame = parts[parts.length - 2];
                        const filename = parts[parts.length - 1];
                        const fileType = path.basename(filename, '.glb');

                        if (!analysisType || fileType === analysisType) {
                            frameMap[frame] = key;
                        }
                    }
                }

                const ordered: Record<string, string> = {};
                const numSort = (a: string, b: string) => Number(a) - Number(b);
                for (const k of Object.keys(frameMap).sort(numSort)) {
                    ordered[k] = frameMap[k];
                }
                result.glb = ordered;
            } catch (err) {
                logger.error(`Failed to list analysis GLBs: ${err}`);
                result.glb = {};
            }
        }

        if (raster) {
            // Raster is not stored per-analysis anymore, return empty
            result.raster = {};
        }

        return result;
    }

    /**
     * Get preview files for a trajectory
     * @param trajectoryId Required trajectoryId
     * @param options Media options
     */
    async getPreviews(trajectoryId: string, options?: GetOptions): Promise<PreviewsResult> {
        const { glb: wantGlb } = this.want(options?.media);
        const result: PreviewsResult = {};

        if (wantGlb) {
            const prefix = `trajectory-${trajectoryId}/previews/`;
            try {
                const glbKeys = await listByPrefix(prefix, SYS_BUCKETS.MODELS);
                const map: Record<string, string> = {};

                for (const key of glbKeys) {
                    if (key.endsWith('.glb')) {
                        const filename = key.split('/').pop();
                        if (filename) {
                            const match = filename.match(/timestep-(\d+)\.glb/);
                            if (match) {
                                const frame = match[1];
                                map[frame] = key;
                            }
                        }
                    }
                }

                const ordered: Record<string, string> = {};
                const numSort = (a: string, b: string) => Number(a) - Number(b);
                for (const k of Object.keys(map).sort(numSort)) {
                    ordered[k] = map[k];
                }
                result.glb = ordered;
            } catch (err) {
                logger.error(`Failed to list preview GLBs: ${err}`);
                result.glb = {};
            }
        }

        return result;
    }

    private want(media?: Media): { raster: boolean, glb: boolean } {
        const m = media ?? 'both';
        return {
            raster: m === 'raster' || m === 'both',
            glb: m === 'glb' || m === 'both'
        };
    }
}

export default TrajectoryFS;