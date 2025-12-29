import DumpStorage from '@/services/dump-storage';
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
    const CHUNK_SIZE = Number(process.env.TRAJECTORY_QUEUE_JOB_CHUNK_SIZE);
    const jobs: any[] = [];
    const sessionId = v4();

    const totalChunks = Math.ceil(validFiles.length / CHUNK_SIZE);
    for (let i = 0; i < validFiles.length; i += CHUNK_SIZE) {
        const jobId = v4();
        const chunk = validFiles.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE);
        const files = chunk.map(({ frameInfo, srcPath }) => ({
            frameInfo,
            frameFilePath: srcPath
        }));

        jobs.push({
            jobId,
            trajectoryId: trajectory._id.toString(),
            chunkIndex,
            totalChunks,
            files,
            teamId,
            name: 'Trajectory Processing',
            message: trajectory.name,
            sessionId,
            sessionStartTime: new Date().toISOString()
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
            name: 'Upload to Object Storage Server',
            message: `Frame ${timestep} from ${trajectory.name}`,
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
    const tempBaseDir = path.join(os.tmpdir(), 'volterra-trajectories');
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

