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

interface CreateTrajectoryOptions {
    files: any[];
    teamId: string;
    userId: string;
    trajectoryName: string;
    originalFolderName?: string;
    onProgress?: (progress: number) => void;
    uploadId?: string;
}

/**
 * Processes incoming raw files, uploads them to Object Storge(MinIO),
 * and dispatches jobs to the processing queue.
 */
const createTrajectory = async ({
    files,
    teamId,
    userId,
    trajectoryName,
    onProgress,
    uploadId
}: CreateTrajectoryOptions): Promise<InstanceType<typeof Trajectory>> => {
    const trajectoryId = new Types.ObjectId();
    const trajectoryIdStr = trajectoryId.toString();

    // Setup temporary directory for initial validation/parsing only.
    const tempBaseDir = path.join(os.tmpdir(), 'volterra-trajectories');
    const workingDir = path.join(tempBaseDir, trajectoryIdStr);

    await fs.mkdir(workingDir, { recursive: true });

    // Pre-calculate total size for progress if possible
    let totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
    // If we only have paths (e.g. from multer diskStorage), we trust multer's size.
    // If we don't have size, we might need to stat. 
    // But let's rely on what we have. 

    // Track bytes processed per file index
    const processedBytesMap: Record<number, number> = {};

    const updateProgress = (index: number, bytes: number) => {
        processedBytesMap[index] = bytes;
        if (totalSize > 0 && onProgress) {
            const totallyProcessed = Object.values(processedBytesMap).reduce((a, b) => a + b, 0);
            onProgress(Math.min(1, totallyProcessed / totalSize));
        }
    };

    // Process files. Validate -> Upload to MinIO -> Prepare Job Data.
    // Use batch processing to prevent overwhelming MinIO with too many concurrent uploads
    const BATCH_SIZE = 5;
    const allResults: any[] = [];

    const processFile = async (file: any, i: number) => {
        let tempPath = file.path;

        // Handle Buffer vs Path(Multer vs SSH).
        // If we only have a buffer, write to disk briefly to let the parser read it.
        if (!tempPath && file.buffer) {
            tempPath = path.join(workingDir, `temp_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
            await fs.writeFile(tempPath, file.buffer);
            // Update size if it was missing 
            if (!file.size) {
                file.size = file.buffer.length;
                totalSize += file.size;
            }
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

        const fileSize = file.size || (await fs.stat(tempPath)).size;

        // Upload to storage using the file path directly (streaming).
        // This prevents loading the entire file into RAM.
        await DumpStorage.saveDump(trajectoryIdStr, frameInfo.timestep, tempPath, (fileProgress) => {
            updateProgress(i, fileProgress * fileSize);
        });

        // Cleanup local temp.
        if (!file.path) await fs.rm(tempPath).catch(() => { });

        return {
            frameInfo,
            srcPath: `minio://${trajectoryIdStr}/${frameInfo.timestep}`,
            originalSize: fileSize,
            originalName: file.originalname || file.name || `frame_${frameInfo.timestep}`
        };
    };

    // Process files in batches to prevent S3 multipart upload errors
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map((file, batchIndex) =>
            processFile(file, i + batchIndex)
        );
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
    }

    const validFiles = (allResults.filter(Boolean) as any[]);

    if (validFiles.length === 0) {
        throw new RuntimeError(ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES, 400);
    }

    // Ensure 100% progress
    if (onProgress) onProgress(1);

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
