/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import logger from '@/logger';
import { listByPrefix, statObject, getStream } from '@/utilities/buckets';
import { SYS_BUCKETS } from '@/config/minio';
import { Trajectory, Analysis } from '@/models';
import { FsEntry, VFSReadStream } from '@/types/services/trajectory-vfs';
import mime from 'mime-types';
import RuntimeError from '@/utilities/runtime-error';
import DumpStorage from '@/services/dump-storage';
import QuickCache from '@/utilities/perf/quick-cache';
import pLimit from '@/utilities/perf/p-limit';
import * as path from 'node:path';
import * as os from 'node:os';

// Concurrent calls to MinIO/DB at 50 to avoid I/O overload
const ioLimit = pLimit(50);
// 10 min cache for sizes
const sizeCache = new QuickCache<number>(1000 * 60 * 10);

export default class TrajectoryVFS{
    readonly userId: string | null;
    readonly baseDir: string;

    constructor(
        userId: string | null = null,
        baseDir = process.env.TRAJECTORY_DIR || path.join(os.tmpdir(), 'opendxa-trajectories')
    ){
        if(!baseDir){
            throw new Error('TRAJECTORY_DIR is not defined.');
        }
        this.userId = userId;
        this.baseDir = path.resolve(baseDir);
    }

    async list(virtualPath: string = ''): Promise<FsEntry[]>{
        const { parts, trajectoryId, analysisId, subSystem, remainingPath } = this.parsePath(virtualPath);
        // If root (/), then list user trajectories
        if(parts.length === 0) return this.listUserTrajectories();
        // Trajectory root
        if(parts.length === 1 && trajectoryId) return this.listTrajectoryRoot(trajectoryId);
        // Subsystems (dumps, raster, analysis/glb, analysis/data)
        if(trajectoryId && subSystem){
            // Dumps 
            if(subSystem === 'dumps') return this.listDumps(trajectoryId, remainingPath);

            // MinIO backed folders (Raster, GLB, Data)
            const config = this.getMinioConfig(trajectoryId, subSystem, analysisId);
            if(config){
                // If we are at the root of an analysis folder (e.g., /analysis-123/), show 'glb' and 'data' folders
                if(subSystem.startsWith('analysis-') && !remainingPath){
                    return this.listAnalysisRoot(trajectoryId, analysisId!);
                }
                // Otherwise list the contents of the MinIO prefix
                return this._listMinioPrefix(config.bucket, config.prefix + remainingPath, virtualPath);
            }
        }

        throw new RuntimeError('PathNotFound', 404);
    }

    async getReadStream(virtualPath: string): Promise<VFSReadStream>{
        const { trajectoryId, analysisId, subSystem, remainingPath } = this.parsePath(virtualPath);
        if(!trajectoryId || !subSystem) throw new RuntimeError('InvalidPath', 400);
        if(subSystem === 'dumps') return this.getDumpStream(trajectoryId, remainingPath);
        const config = this.getMinioConfig(trajectoryId, subSystem, analysisId);
        if(config && remainingPath){
            const objectKey = config.prefix + remainingPath;
            return this._streamMinioObject(config.bucket, objectKey);
        }
        throw new RuntimeError('FileNotFound', 404);
    }

    private async listUserTrajectories(): Promise<FsEntry[]>{
        if(!this.userId) throw new RuntimeError('Unauthorized', 401);
        try{
            const trajectories = await Trajectory.find({
                createdBy: this.userId
            }).select('_id updatedAt').lean();
            return Promise.all(trajectories.map((trajectory) => ioLimit(async () => {
                const trajectoryId = trajectory._id.toString();
                const totalSize = await this.calculateTrajectorySize(trajectoryId);
                return this.createDirEntry(`trajectory-${trajectoryId}`, `trajectory-${trajectoryId}`, totalSize, trajectory.updatedAt);
            })));
        }catch(err){
            logger.error(`List error: ${err}`);
            return [];
        }
    }

    private async listTrajectoryRoot(trajectoryId: string): Promise<FsEntry[]>{
        // Fetch of root stats
        const [dumpsSize, rasterSize, analyses] = await Promise.all([
            DumpStorage.calculateSize(trajectoryId),
            this.calculatePrefixSize(SYS_BUCKETS.RASTERIZER, `trajectory-${trajectoryId}/previews/`),
            Analysis.find({ trajectory: trajectoryId }).select('_id updatedAt').lean()
        ]);

        const entries: FsEntry[] = [
            this.createDirEntry('dumps', `trajectory-${trajectoryId}/dumps`, dumpsSize),
            this.createDirEntry('raster', `trajectory-${trajectoryId}/raster`, rasterSize)
        ];

        const analysisEntries = await Promise.all(analyses.map((analysis: any) => ioLimit(async () => {
            const analysisId = analysis._id.toString();
            const size = await this.calculateAnalysisSize(trajectoryId, analysisId);
            return this.createDirEntry(`analysis-${analysisId}`, `trajectory-${trajectoryId}/analysis-${analysisId}`, size, analysis.updatedAt);
        })));

        return [...entries, ...analysisEntries];
    }

    private async listAnalysisRoot(trajectoryId: string, analysisId: string): Promise<FsEntry[]>{
        const [glbSize, dataSize] = await Promise.all([
            this.calculatePrefixSize(SYS_BUCKETS.MODELS, `${trajectoryId}/${analysisId}/glb/`),
            this.calculatePrefixSize(SYS_BUCKETS.MODELS, `${trajectoryId}/${analysisId}/data/`)
        ]);
        return [
            this.createDirEntry('glb', `trajectory-${trajectoryId}/analysis-${analysisId}/glb`, glbSize),
            this.createDirEntry('data', `trajectory-${trajectoryId}/analysis-${analysisId}/data`, dataSize)
        ];
    }

    /**
     * List objects from any bucket/prefix and maps them to FsEntry.
     * Automatically handles folders vs files structure.
     */
    private async _listMinioPrefix(bucket: string, prefix: string, virtualBase: string): Promise<FsEntry[]>{
        // Ensure prefix ends with / for a directory listing logic
        const searchPrefix = prefix.endsWith('/') || prefix === '' ? prefix : prefix + '/';
        try{
            const keys = await listByPrefix(searchPrefix, bucket);
            const dirs = new Set<string>();
            const files: string[] = [];

            // Pre-classification (cpu bound)
            for(const key of keys){
                const rel = key.substring(searchPrefix.length);
                const slashIdx = rel.indexOf('/');
                if(slashIdx > -1) dirs.add(rel.substring(0, slashIdx));
                else if(rel) files.push(key);
            }

            const dirEntries = Array.from(dirs).map((name) =>
                this.createDirEntry(name, path.join(virtualBase, name)));

            // Stat for files (network bound)
            const fileEntries = await Promise.all(files.map((key) => ioLimit(async () => {
                try{
                    const stat = await statObject(key, bucket);
                    const name = path.basename(key);
                    return {
                        type: 'file',
                        name: name,
                        relPath: path.join(virtualBase, name),
                        size: stat.size,
                        mtime: stat.lastModified.toISOString(),
                        ext: path.extname(name),
                        mime: mime.lookup(name) || 'application/octet-stream'
                    } as FsEntry;
                }catch{
                    return null;
                }
            })));

            return [...dirEntries, ...fileEntries.filter((f): f is FsEntry => f !== null)];
        }catch(err){
            logger.error(`MinIO list failed [${bucket}/${prefix}]: ${err}`);
            return [];
        }
    }

    /**
     * Streams any object from MinIO with generic stats
     */
    private async _streamMinioObject(bucket: string, key: string){
        try{
            const [stat, stream] = await Promise.all([statObject(key, bucket), getStream(key, bucket)]);
            return {
                stream,
                size: stat.size,
                contentType: mime.lookup(key) || 'application/octet-stream',
                filename: path.basename(key)
            }
        }catch(err){
            throw new RuntimeError('FileNotFound', 404);
        }
    }

    private async listDumps(trajectoryId: string, subPath: string): Promise<FsEntry[]>{
        // Dumps are flat
        if(subPath) return [];
        try{
            const timesteps = await DumpStorage.listDumps(trajectoryId);
            const entries = await Promise.all(timesteps.map((ts) => ioLimit(async () => {
                const obj = `trajectory-${trajectoryId}/timestep-${ts}.dump.gz`;
                try{
                    const stat = await statObject(obj, SYS_BUCKETS.DUMPS);
                    return {
                        type: 'file', 
                        name: ts, 
                        relPath: `trajectory-${trajectoryId}/dumps/${ts}`,
                        size: stat.size, 
                        mtime: stat.lastModified.toISOString(),
                        ext: '.dump.gz', 
                        mime: 'application/gzip'
                    } as FsEntry;
                }catch{
                    return null;
                }
            })));
            return entries.filter((e): e is FsEntry => e !== null);
        }catch{
            return [];
        }
    }

    private async getDumpStream(trajectoryId: string, timestep: string){
        try{
            const stream = await DumpStorage.getDumpStream(trajectoryId, timestep);
            const stat = await statObject(`trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`, SYS_BUCKETS.DUMPS);
            return {
                stream,
                size: stat.size,
                contentType: 'text/plain',
                filename: timestep
            };
        }catch{
            throw new RuntimeError('FileNotFound', 404);
        }
    }

    private parsePath(virtualPath: string){
        const clean = virtualPath.replace(/^\/+|\/+$/g, '');
        const parts = clean ? clean.split('/') : [];
        
        const trajectoryId = parts[0]?.replace(/^trajectory-/, '') || null;
        // dumps, raster, analysis-X
        const subSystem = parts[1] || null; 

        let analysisId: string | null = null;
        const remainingPath = parts.slice(2).join('/');
        
        if(subSystem?.startsWith('analysis-')){
            analysisId = subSystem.replace(/^analysis-/, '');
        }

        return { parts, trajectoryId, subSystem, analysisId, remainingPath };
    }

    private getMinioConfig(
        trajectoryId: string, 
        subSystem: string,
        analysisId: string | null
    ): { bucket: string, prefix: string } | null {
        if(subSystem === 'raster'){
            return { bucket: SYS_BUCKETS.RASTERIZER, prefix: `trajectory-${trajectoryId}/previews/` };
        }

        if(subSystem === 'previews'){
            return { bucket: SYS_BUCKETS.MODELS, prefix: `trajectory-${trajectoryId}/previews/` };
        }

        if(analysisId){
            return { bucket: SYS_BUCKETS.MODELS, prefix: `${trajectoryId}/${analysisId}/` };
        }

        return null;
    }

    private async calculateTrajectorySize(trajectoryId: string): Promise<number>{
        const key = `traj_${trajectoryId}`;
        const cache = sizeCache.get(key);
        if(cache !== undefined) return cache;

        const [dumps, raster, analyses] = await Promise.all([
            DumpStorage.calculateSize(trajectoryId),
            this.calculatePrefixSize(SYS_BUCKETS.RASTERIZER, `trajectory-${trajectoryId}/previews/`),
            Analysis.find({ trajectory: trajectoryId }).select('_id').lean()
        ]);

        let analysisSize = 0;
        if(analyses.length){
            const sizes = await Promise.all(analyses.map((x: any) => this.calculateAnalysisSize(trajectoryId, x._id.toString())));
            analysisSize = sizes.reduce((size: number, n: number) => size + n, 0);
        }

        const total = dumps + raster + analysisSize;
        sizeCache.set(key, total);
        return total;
    }

    private async calculateAnalysisSize(trajectoryId: string, analysisId: string): Promise<number>{
        const key = `ana_${trajectoryId}_${analysisId}`;
        const cache = sizeCache.get(key);
        if(cache !== undefined) return cache;

        const [glb, data] = await Promise.all([
            this.calculatePrefixSize(SYS_BUCKETS.MODELS, `${trajectoryId}/${analysisId}/glb/`),
            this.calculatePrefixSize(SYS_BUCKETS.MODELS, `${trajectoryId}/${analysisId}/data/`)
        ]);

        const total = glb + data;
        sizeCache.set(key, total);
        return total;
    }

    private async calculatePrefixSize(bucket: string, prefix: string): Promise<number>{
        const key = `sz_${bucket}_${prefix}`;
        const cache = sizeCache.get(key);
        if(cache !== undefined) return cache;

        try{
            const keys = await listByPrefix(prefix, bucket);
            let total = 0;
            // Batch processing for memory safety
            const chunk = 100;
            for(let i = 0; i < keys.length; i += chunk){
                const sizes = await Promise.all(keys.slice(i, i + chunk).map((key) => ioLimit(async () => {
                    try{
                        const st = await statObject(key, bucket);
                        return st.size;
                    }catch{
                        return 0;
                    }
                })));
                total += sizes.reduce((a: number, b: number) => a + b, 0);
            }
            sizeCache.set(key, total);
            return total;
        }catch{
            return 0;
        }
    }

    private createDirEntry(name: string, relPath: string, size: number = 0, date?: any): FsEntry{
        return {
            type: 'dir', name, relPath, size,
            mtime: date ? new Date(date).toISOString() : new Date().toISOString()
        };
    }
};