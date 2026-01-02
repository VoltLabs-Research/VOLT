import DumpStorage from '@/services/trajectory/dump-storage';
import tempFileManager from '@/services/temp-file-manager';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import { Trajectory } from '@/models';
import { getCloudUploadQueue, getTrajectoryProcessingQueue } from '@/queues';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { Worker } from 'worker_threads';
import { ITrajectory } from '@/types/models/trajectory';
import { CloudUploadJob } from '@/types/services/cloud-upload';

interface CreateTrajectoryOptions {
    files: any[];
    teamId: string;
    userId: string;
    trajectoryName: string;
    originalFolderName?: string;
    onProgress?: (progress: number) => void;
};

interface ParseResult {
    frameInfo: any;
    srcPath: string;
    originalSize: number;
    originalName: string;
}

const WORKER_PATH = path.join(process.cwd(), 'workers/trajectory-parser.worker.ts');

/**
 * Spawns a worker thread and processes files in parallel batches.
 * Returns parsed results for all valid files.
 */
const parseFilesWithWorker = async (
    trajectoryId: string,
    files: any[],
    workingDir: string,
    onProgress?: (progress: number) => void
): Promise<ParseResult[]> => {
    return new Promise(async (resolve, reject) => {
        const worker = new Worker(WORKER_PATH, {
            execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
        });

        const results: (ParseResult | null)[] = new Array(files.length).fill(null);
        let completedCount = 0;
        let sentCount = 0;
        const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

        const pendingTasks = new Map<number, { resolve: (v: any) => void }>();

        worker.on('message', (message: any) => {
            if (message.type !== 'result') return;

            const { taskId, success, data, error } = message;
            completedCount++;

            if (success && data) {
                results[taskId] = data;
            } else if (!success) {
                console.error(`[createTrajectory] Worker parsing failed for task ${taskId}:`, error);
            }

            // Report progress
            if (onProgress && totalSize > 0) {
                const processed = results
                    .filter(Boolean)
                    .reduce((acc, r) => acc + (r?.originalSize || 0), 0);
                onProgress(Math.min(1, processed / totalSize));
            }

            // Check if all done
            if (completedCount === files.length) {
                worker.terminate();
                resolve(results.filter(Boolean) as ParseResult[]);
            }
        });

        worker.on('error', (err) => {
            worker.terminate();
            reject(err);
        });

        worker.on('exit', (code) => {
            if (code !== 0 && completedCount < files.length) {
                reject(new Error(`Worker exited with code ${code}`));
            }
        });

        // Send tasks to worker
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let tempPath = file.path;

            // If we only have a buffer, write to disk briefly
            if (!tempPath && file.buffer) {
                tempPath = path.join(workingDir, `temp_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
                await fs.writeFile(tempPath, file.buffer);
            }

            if (!tempPath) {
                completedCount++;
                continue;
            }

            const fileSize = file.size || 0;

            worker.postMessage({
                type: 'parse',
                taskId: i,
                trajectoryId,
                tempPath,
                originalName: file.originalname || file.name || `frame_${i}`,
                fileSize
            });

            sentCount++;
        }

        // If no tasks were sent, resolve immediately
        if (sentCount === 0) {
            worker.terminate();
            resolve([]);
        }
    });
};

const dispatchTrajectoryJobs = async (validFiles: any[], trajectory: ITrajectory, teamId: string) => {
    const queue = getTrajectoryProcessingQueue();
    const jobs: any[] = [];
    const sessionId = v4();

    for (const { frameInfo, srcPath } of validFiles) {
        const timestep = frameInfo?.timestep ?? 0;
        jobs.push({
            jobId: v4(),
            trajectoryId: trajectory._id.toString(),
            trajectoryName: trajectory.name,
            timestep,
            teamId,
            name: 'Convert to GLB',
            message: trajectory.name,
            sessionId,
            sessionStartTime: new Date().toISOString(),
            file: {
                frameInfo,
                frameFilePath: srcPath
            },
            folderPath: '',
            tempFolderPath: ''
        });
    }

    await queue.addJobs(jobs);
};

/**
 * Processes incoming raw files, uploads them to Object Storage (MinIO),
 * and dispatches jobs to the processing queue.
 */
const createTrajectory = async ({
    files,
    teamId,
    userId,
    trajectoryName,
    onProgress
}: CreateTrajectoryOptions): Promise<InstanceType<typeof Trajectory>> => {
    const trajectoryId = new Types.ObjectId();
    const trajectoryIdStr = trajectoryId.toString();

    // Create trajectory immediately with waiting_for_proccess status
    const newTrajectory = await Trajectory.create({
        _id: trajectoryId,
        name: trajectoryName,
        team: teamId,
        createdBy: userId,
        frames: [],
        status: 'waiting_for_proccess',
        stats: {
            totalFiles: files.length,
            totalSize: files.reduce((acc, f) => acc + (f.size || 0), 0)
        }
    });

    // Process files in background (fire-and-forget)
    processFilesInBackground(trajectoryIdStr, files, teamId, onProgress).catch((err) => {
        console.error(`[createTrajectory] Background processing failed for ${trajectoryIdStr}:`, err);
        Trajectory.findByIdAndUpdate(trajectoryId, { status: 'failed' }).catch(() => { });
    });

    return newTrajectory;
};

const dispatchCloudUploadJobs = async (trajectory: ITrajectory, teamId: string) => {
    const queue = getCloudUploadQueue();
    const jobs: CloudUploadJob[] = [];
    const sessionId = v4();

    for (let i = 0; i < trajectory.frames.length; i++) {
        const jobId = v4();
        const { timestep } = trajectory.frames[i];
        jobs.push({
            jobId,
            teamId,
            timestep,
            trajectoryId: trajectory._id.toString(),
            trajectoryName: trajectory.name,
            name: 'Upload Frame',
            message: trajectory.name,
            sessionId
        });
    }

    await queue.addJobs(jobs);
};

const processFilesInBackground = async (
    trajectoryIdStr: string,
    files: any[],
    teamId: string,
    onProgress?: (progress: number) => void
) => {
    const tempBaseDir = tempFileManager.rootPath;
    const workingDir = path.join(tempBaseDir, trajectoryIdStr);
    await fs.mkdir(workingDir, { recursive: true });

    // Use worker thread for parsing (non-blocking)
    const validFiles = await parseFilesWithWorker(trajectoryIdStr, files, workingDir, onProgress);

    if (validFiles.length === 0) {
        await Trajectory.findByIdAndUpdate(trajectoryIdStr, { status: 'failed' });
        throw new RuntimeError(ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES, 400);
    }

    const validTotalSize = validFiles.reduce((acc, f) => acc + f.originalSize, 0);
    const frames = validFiles.map((f) => f.frameInfo);

    const trajectory = await Trajectory.findByIdAndUpdate(
        trajectoryIdStr,
        {
            frames,
            status: 'processing',
            stats: {
                totalFiles: validFiles.length,
                totalSize: validTotalSize
            }
        },
        { new: true }
    );

    if (onProgress) onProgress(1);
    if (trajectory) {
        await dispatchTrajectoryJobs(validFiles, trajectory, teamId);
        await dispatchCloudUploadJobs(trajectory, teamId);
    }
};

export default createTrajectory;

