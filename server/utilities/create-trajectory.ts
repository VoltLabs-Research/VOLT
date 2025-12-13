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

/**
 * Processes incoming raw files, uploads them to Object Storge (MinIO),
 * and dispatches jobs to the processing queue.
 * 
 * @param files - Array of file objects (Multer or SSH stream buffers).
 * @param teamId - The ID of the team owning the trajectory.
 * @param userId - the ID of the user creating the trajectory.
 * @param trajectoryName - The human-readable name of the trajectory.
 */
const createTrajectory = async (files: any[], teamId: string, userId: string, trajectoryName: string) => {
    const trajectoryId = new Types.ObjectId();
    const trajectoryIdStr = trajectoryId.toString();

    // Setup temporary directory for initial validation/parsing only.
    const tempBaseDir = path.join(os.tmpdir(), 'volterra-trajectories');
    const workingDir = path.join(tempBaseDir, trajectoryIdStr);

    await fs.mkdir(workingDir, { recursive: true });

    // Process files. Validate -> Upload to MinIO -> Prepare Job Data.
    const filePromises = files.map(async (file: any, i: number) => {
        let tempPath = file.path;

        // Handle Buffer vs Path (Multer vs SSH).
        // If we only have a buffer, write to disk briefly to let the parser read it.
        if (!tempPath && file.buffer) {
            tempPath = path.join(workingDir, `temp_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
            await fs.writeFile(tempPath, file.buffer);
        }

        // Parse and validate using the centralized factory
        let frameInfo;
        try {
            const parsed = await TrajectoryParserFactory.parse(tempPath);
            frameInfo = parsed.metadata;
        } catch (err) {
            if (!file.path) await fs.rm(tempPath).catch(() => { });
            return null;
        }

        // Prepare data for MinIO. We need the buffer to upload to Object Storage.
        let buffer = file.buffer;
        if (!buffer) {
            // If it came from a file path (e.g. multipart), read it into buffer now
            buffer = await fs.readFile(tempPath);
        }

        // Upload to storage. 
        await DumpStorage.saveDump(trajectoryIdStr, frameInfo.timestep, buffer);

        // Cleanup local temp.
        if (!file.path) await fs.rm(tempPath).catch(() => { });

        return {
            frameInfo,
            srcPath: `minio://${trajectoryIdStr}/${frameInfo.timestep}`,
            originalSize: file.size || buffer.length,
            originalName: file.originalname || file.name || `frame_${frameInfo.timestep}`
        };
    });

    // Wait for all uploads to complete
    const results = await Promise.all(filePromises);
    const validFiles = (results.filter(Boolean) as any[]);

    if (validFiles.length === 0) {
        throw new RuntimeError(ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES, 400);
    }

    const totalSize = validFiles.reduce((acc, f) => acc + f.originalSize, 0);
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
            totalSize
        }
    });

    // Dispatch jobs to queue
    const queue = getTrajectoryProcessingQueue();
    const chunkSize = 20;
    const jobs: any[] = [];
    const sessionId = v4();

    for (let i = 0; i < validFiles.length; i += chunkSize) {
        const chunk = validFiles.slice(i, i + chunkSize);
        jobs.push({
            jobId: v4(),
            trajectoryId: newTrajectory._id.toString(),
            chunkIndex: Math.floor(i / chunkSize),
            totalChunks: Math.ceil(validFiles.length / chunkSize),
            files: chunk.map(({ frameInfo, srcPath }) => ({
                frameInfo,
                frameFilePath: srcPath
            })),
            teamId,
            name: 'Upload Trajectory',
            message: trajectoryName,
            sessionId,
            sessionStartTime: new Date().toISOString()
        });
    }

    await queue.addJobs(jobs);
    await fs.rm(workingDir, { recursive: true, force: true }).catch(() => { });

    return newTrajectory;
};

export default createTrajectory;