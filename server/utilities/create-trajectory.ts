import DumpStorage from '@/services/dump-storage';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import TrajectoryParserFactory from '@/parsers/factory';
import { Trajectory } from '@/models';
import { getTrajectoryProcessingQueue } from '@/queues';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ITrajectory } from '@/types/models/trajectory';

interface CreateTrajectoryOptions {
    files: any[];
    teamId: string;
    userId: string;
    trajectoryName: string;
    originalFolderName?: string;
    onProgress?: (progress: number) => void;
};

const processTrajectoryFile = async (
    trajectoryId: string, 
    updateProgress: any,
    workingDir: string, 
    file: any, 
    i: number
) => {
    let tempPath = file.path;

    // If we only have a buffer, write to disk briefly to let the parser read it.
    if(!tempPath && file.buffer){
        tempPath = path.join(workingDir, `temp_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        await fs.writeFile(tempPath, file.buffer);
    }

    // Parse and validate
    let frameInfo;
    try{
        const parsed = await TrajectoryParserFactory.parse(tempPath);
        frameInfo = parsed.metadata;
    }catch(err){
        if(!file.path) await fs.rm(tempPath).catch(() => {});
        return null;
    }

    const fileSize = file.size || (await fs.stat(tempPath)).size;

    // Upload to storage using the file path directly (streaming).
    await DumpStorage.saveDump(trajectoryId, frameInfo.timestep, tempPath, (progress) => {
        updateProgress(i, progress * fileSize);
    });

    if(!file.path) await fs.rm(tempPath).catch(() => {});

    return {
        frameInfo,
        srcPath: `minio://${trajectoryId}/${frameInfo.timestep}`,
        originalSize: fileSize,
        originalName: file.originalname || file.name || `frame_${frameInfo.timestep}`
    };
};

const dispatchTrajectoryJobs = async (validFiles: any[], trajectory: ITrajectory, teamId: string) => {
    const queue = getTrajectoryProcessingQueue();
    const CHUNK_SIZE = 20;
    const jobs: any[] = [];
    const sessionId = v4();

    const totalChunks = Math.ceil(validFiles.length / CHUNK_SIZE);
    for(let i = 0; i < validFiles.length; i += CHUNK_SIZE){
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
            name: 'Upload Trajectory',
            message: trajectory.name,
            sessionId,
            sessionStartTime: new Date().toISOString()
        });
    }

    await queue.addJobs(jobs);
};

/**
 * Processes incoming raw files, uploads them to Object Storge(MinIO),
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

    // Setup temporary directory for initial validation/parsing only.
    const tempBaseDir = path.join(os.tmpdir(), 'volterra-trajectories');
    const workingDir = path.join(tempBaseDir, trajectoryIdStr);

    await fs.mkdir(workingDir, { recursive: true });

    // Pre-calculate total size for progress if possible
    let totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

    // Track bytes processed per file index
    const processedBytesMap: Record<number, number> = {};

    const updateProgress = (index: number, bytes: number) => {
        processedBytesMap[index] = bytes;
        if(totalSize > 0 && onProgress){
            const totallyProcessed = Object.values(processedBytesMap).reduce((a, b) => a + b, 0);
            onProgress(Math.min(1, totallyProcessed / totalSize));
        }
    };

    // Process files. Validate -> Upload to MinIO -> Prepare Job Data.
    const BATCH_SIZE = 8;
    const allResults: any[] = [];

    for(let i = 0; i < files.length; i += BATCH_SIZE){
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map((file, batchIndex) => 
            processTrajectoryFile(trajectoryIdStr, updateProgress, workingDir, file, i + batchIndex));
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
    }

    const validFiles = allResults.filter(Boolean);
    if(validFiles.length === 0){
        throw new RuntimeError(ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES, 400);
    }

    const validTotalSize = validFiles.reduce((acc, f) => acc + f.originalSize, 0);
    const frames = validFiles.map((f) => f.frameInfo);

    const newTrajectory = await Trajectory.create({
        _id: trajectoryId,
        name: trajectoryName,
        team: teamId,
        createdBy: userId,
        frames,
        status: 'processing',
        stats: {
            totalFiles: validFiles.length,
            totalSize: validTotalSize
        }
    });

    await dispatchTrajectoryJobs(validFiles, newTrajectory, teamId);

    // The file upload was completed in previous steps; however, we'll wait
    // until the jobs are queued before marking it as complete. 
    // Otherwise, the path card will briefly appear and disappear from the front end.
    if(onProgress) onProgress(1);

    await fs.rm(workingDir, { recursive: true, force: true }).catch(() => { });

    return newTrajectory;
};

export default createTrajectory;
