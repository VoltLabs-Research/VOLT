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

import mime from 'mime-types';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import DumpStorage from '@/services/dump-storage';
import logger from '@/logger';
import storage from '@/services/storage';
import QuickCache from '@/utilities/perf/quick-cache';
import pLimit from '@/utilities/perf/p-limit';
import { SYS_BUCKETS } from '@/config/minio';
import { Trajectory, Analysis } from '@/models';
import { FsEntry, VFSReadStream } from '@/types/services/trajectory-vfs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Concurrency limiter for I/O operations(MinIO/MongoDB).
 * Limits concurrent promises to 50 to prevent file descriptor exhaustion or network timeouts.
 */
const ioLimit = pLimit(50);

/**
 * In-memory cache for directory size calculations.
 * Used to avoid expensive recursive S3 list/stat operations on repeated requests.
 */
const sizeCache = new QuickCache<number>(1000 * 60 * 10);

/**
 * A Virtual File System(VFS) implementation for Trajectories.
 *
 * This class abstracts the complexity of retrieving data from distributed sources
 * (MongoDB metadata, MinIO object storage, and DumpStorage) and presents them
 * as a unified, navigable directory structure.
 */
export default class TrajectoryVFS{
    /** The ID of the user accessing the VFS. */
    readonly userId: string | null;

    /**
     * Creates a new instance of the Trajectory VFS.
     *
     * @param userId - The ID of the user context. If provided, listings may be filtered by ownership.
     */
    constructor(
        userId: string | null = null
    ){
        this.userId = userId;
    }

    /**
     * Lists the contents of a directory at the given virtual path.
     *
     * This method acts as a router, delegating the listing logic to specific
     * internal methods based on the depth and components of the path.
     *
     * @param virtualPath - The virtual path to list(e.g., /trajector-123/dumps/). Defaults to root.
     * @returns A promise resolving to an array of {@link FsEntry} objects representing files and directories.
     * @throws {RuntimeError} 404 if the path does not exist.
     */
    async list(virtualPath: string = ''): Promise<FsEntry[]>{
        const { parts, trajectoryId, analysisId, subSystem, remainingPath } = this.parsePath(virtualPath);
        // If root(/), then list user trajectories
        if(parts.length === 0) return this.listUserTrajectories();
        // Trajectory root
        if(parts.length === 1 && trajectoryId) return this.listTrajectoryRoot(trajectoryId);
        // Subsystems(dumps, raster, analysis/glb, analysis/data)
        if(trajectoryId && subSystem){
            // Dumps
            if(subSystem === 'dumps') return this.listDumps(trajectoryId, remainingPath);

            // MinIO backed folders(Raster, GLB, Data)
            const config = this.getMinioConfig(trajectoryId, subSystem, analysisId);
            if(config){
                // If we are at the root of an analysis folder(e.g., /analysis-123/), show 'glb' and 'data' folders
                if(subSystem.startsWith('analysis-') && !remainingPath) {
                    return this.listAnalysisRoot(trajectoryId, analysisId!);
                }
                // Otherwise list the contents of the MinIO prefix
                return this._listMinioPrefix(config.bucket, config.prefix + remainingPath, virtualPath);
            }
        }

        throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_PATH_NOT_FOUND, 404);
    }

    /**
     * Retrieves a readable stream for a file at the given virtual path.
     *
     * @param virtualPath - The full virtual path to the file.
     * @returns A promise resolving to a {@link VFSReadStream} containing the data stream and metadata.
     * @throws {RuntimeError} 400 if the path is invalid.
     * @throws {RuntimeError} 404 if the file is not found in the backing storage.
     */
    async getReadStream(virtualPath: string): Promise<VFSReadStream>{
        const { trajectoryId, analysisId, subSystem, remainingPath } = this.parsePath(virtualPath);
        if(!trajectoryId || !subSystem) throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_INVALID_PATH, 400);
        if(subSystem === 'dumps') return this.getDumpStream(trajectoryId, remainingPath);
        const config = this.getMinioConfig(trajectoryId, subSystem, analysisId);
        if(config && remainingPath){
            const objectKey = config.prefix + remainingPath;
            return this._streamMinioObject(config.bucket, objectKey);
        }
        throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_FILE_NOT_FOUND, 404);
    }

    /**
     * Lists all trajectories belonging to the current `userId`.
     * Maps MongoDB documents to virtual directory entries.
     *
     * @internal
     */
    private async listUserTrajectories(): Promise<FsEntry[]>{
        if(!this.userId) throw new RuntimeError(ErrorCodes.AUTH_UNAUTHORIZED, 401);
        try{
            const trajectories = await Trajectory.find({
                createdBy: this.userId
            }).select('_id updatedAt').lean();
            return Promise.all(trajectories.map((trajectory) => ioLimit(async() => {
                const trajectoryId = trajectory._id.toString();
                const totalSize = await this.calculateTrajectorySize(trajectoryId);
                return this.createDirEntry(`trajectory-${trajectoryId}`, `trajectory-${trajectoryId}`, totalSize, trajectory.updatedAt);
            })));
        }catch(err){
            logger.error(`List error: ${err}`);
            return [];
        }
    }

    /**
     * Lists the root subsystems of a specific trajectory(dumps, raster, analyses).
     *
     * @param trajectoryId - The ID of the trajectory to inspect.
     * @internal
     */
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

        const analysisEntries = await Promise.all(analyses.map((analysis: any) => ioLimit(async() => {
            const analysisId = analysis._id.toString();
            const size = await this.calculateAnalysisSize(trajectoryId, analysisId);
            return this.createDirEntry(`analysis-${analysisId}`, `trajectory-${trajectoryId}/analysis-${analysisId}`, size, analysis.updatedAt);
        })));

        return [...entries, ...analysisEntries];
    }

    /**
     * Lists the standard subfolders for a specific analysis(glb, data).
     *
     * @param trajectoryId - The parent trajectory ID.
     * @param analysisId - The analysis ID.
     * @internal
     */
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
     * Generic helper to list objects from a MinIO bucket and map them to virtual FsEntries.
     * Separates results into "Folders" (prefixes) and "Files" (objects).
     *
     * @param bucket - The MinIO bucket name.
     * @param prefix - The prefix to search within.
     * @param virtualBase - The virtual path corresponding to this prefix.
     * @internal
     */
    private async _listMinioPrefix(bucket: string, prefix: string, virtualBase: string): Promise<FsEntry[]>{
        // Ensure prefix ends with / for a directory listing logic
        const searchPrefix = prefix.endsWith('/') || prefix === '' ? prefix : prefix + '/';
        try{
            const dirs = new Set<string>();
            const files: string[] = [];

            // Pre-classification(cpu bound)
            for await (const key of storage.listByPrefix(bucket, searchPrefix)) {
                const rel = key.substring(searchPrefix.length);
                const slashIdx = rel.indexOf('/');
                if(slashIdx > -1) dirs.add(rel.substring(0, slashIdx));
                else if(rel) files.push(key);
            }

            const dirEntries = Array.from(dirs).map((name) =>
                this.createDirEntry(name, path.join(virtualBase, name)));

            // Stat for files(network bound)
            const fileEntries = await Promise.all(files.map((key) => ioLimit(async() => {
                try{
                    const stat = await storage.getStat(bucket, key);
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
                } catch {
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
     * Streams an object directly from MinIO and retrieves its metadata.
     * @internal
     */
    private async _streamMinioObject(bucket: string, key: string) {
        try{
            const [stat, stream] = await Promise.all([storage.getStat(bucket, key), storage.getStream(bucket, key)]);
            return {
                stream,
                size: stat.size,
                contentType: mime.lookup(key) || 'application/octet-stream',
                filename: path.basename(key)
            }
        }catch(err){
            console.log(err);
            throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_FILE_NOT_FOUND, 404);
        }
    }

    /**
     * Lists simulation dump files.
     * Dumps are stored in a flat structure but mapped virtually here.
     * @internal
     */
    private async listDumps(trajectoryId: string, subPath: string): Promise<FsEntry[]>{
        // Dumps are flat
        if(subPath) return [];
        try{
            const timesteps = await DumpStorage.listDumps(trajectoryId);
            const entries = await Promise.all(timesteps.map((ts) => ioLimit(async() => {
                const obj = `trajectory-${trajectoryId}/timestep-${ts}.dump.gz`;
                try{
                    const stat = await storage.getStat(SYS_BUCKETS.DUMPS, obj);
                    return {
                        type: 'file',
                        name: ts,
                        relPath: `trajectory-${trajectoryId}/dumps/${ts}`,
                        size: stat.size,
                        mtime: stat.lastModified.toISOString(),
                        ext: '.dump.gz',
                        mime: 'application/gzip'
                    } as FsEntry;
                } catch {
                    return null;
                }
            })));
            return entries.filter((e): e is FsEntry => e !== null);
        } catch{
            return [];
        }
    }

    private async getDumpStream(trajectoryId: string, timestep: string) {
        try{
            const stream = await DumpStorage.getDumpStream(trajectoryId, timestep);
            const stat = await storage.getStat(SYS_BUCKETS.DUMPS, `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`);
            return {
                stream,
                size: stat.size,
                contentType: 'text/plain',
                filename: timestep
            };
        } catch {
            throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_FILE_NOT_FOUND, 404);
        }
    }

    /**
     * Parses a virtual path string into its semantic components.
     *
     * @param virtualPath - The raw path string.
     * @returns An object containing the parsed IDs, subsystem type, and remaining path.
     * @internal
     */
    private parsePath(virtualPath: string) {
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

    /**
     * Maps a virtual subsystem to a physical MinIO bucket and prefix.
     * @internal
     */
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

    /**
     * Calculates the total size of a trajectory(dumps + raster + analyses).
     * Uses sizeCache to improve perfomance.
     * @internal
     */
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

    /**
     * Calculates the size of a specific analysis(glb + data).
     * @internal
     */
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

    /**
     * Calculates the size of all objects sharing a specific MinIO prefix.
     * Batches requests in chunk of 100 to avoid IO limit issues.
     * @internal
     */
    private async calculatePrefixSize(bucket: string, prefix: string): Promise<number>{
        const key = `sz_${bucket}_${prefix}`;
        const cache = sizeCache.get(key);
        if(cache !== undefined) return cache;

        let total = 0;
        const BATCH_SIZE = 100;
        const pendingTasks: Promise<number>[] = [];

        for await (const objectName of storage.listByPrefix(bucket, prefix)) {
            const task = ioLimit(async() => {
                try{
                    const stat = await storage.getStat(bucket, objectName);
                    return stat.size;
                } catch {
                    return 0;
                }
            });

            pendingTasks.push(task);

            if(pendingTasks.length >= BATCH_SIZE){
                const sizes = await Promise.all(pendingTasks);
                total += sizes.reduce((acc, val) => acc + val, 0);
                pendingTasks.length = 0;
            }
        }

        if(pendingTasks.length > 0){
            const sizes = await Promise.all(pendingTasks);
            total += sizes.reduce((acc, val) => acc + val, 0);
        }

        sizeCache.set(key, total);
        return total;
    }

    private createDirEntry(name: string, relPath: string, size: number = 0, date?: any): FsEntry{
        return {
            type: 'dir', name, relPath, size,
            mtime: date ? new Date(date).toISOString() : new Date().toISOString()
        };
    }
};
