import { parentPort } from 'node:worker_threads';
import mongoConnector from '@/utilities/mongo/mongo-connector';
import { SSHImportJob } from '@/types/services/ssh-import-queue';
import { SSHConnection } from '@/models';
import { ErrorCodes } from '@/constants/error-codes';
import sshService from '@/services/ssh';
import * as fs from 'fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import createTrajectory from '@/utilities/create-trajectory';
import logger from '@/logger';
import '@/config/env';

const processJob = async (job: SSHImportJob) => {
    const { jobId, sshConnectionId, remotePath, teamId, userId } = job;

    const connection = await SSHConnection.findById(sshConnectionId).select('+encryptedPassword');
    console.log(sshConnectionId);
    if (!connection) {
        throw new Error(ErrorCodes.SSH_CONNECTION_NOT_FOUND);
    }

    const fileStats = await sshService.getFileStats(connection, remotePath);
    if (!fileStats) {
        throw new Error(ErrorCodes.SSH_PATH_NOT_FOUND);
    }

    let localFiles: string[] = [];
    const trajectoryName = fileStats.name || 'SSH Import';

    const tempBaseDir = path.join(os.tmpdir(), 'volterra-imports');
    const localFolder = path.join(tempBaseDir, jobId);

    if (fileStats.isDirectory) {
        localFiles = await sshService.downloadDirectory(
            connection,
            remotePath,
            localFolder,
            (progress) => {
                const percentage = 5 + Math.round((progress.downloadedBytes / progress.totalBytes) * 75);
                parentPort?.postMessage({
                    jobId,
                    status: 'progress',
                    progress: percentage,
                    message: `Downloading ${progress.downloadedBytes} of ${progress.totalBytes}b (${percentage}%)`
                });
            }
        );
    } else {
        const localFilePath = path.join(localFolder, fileStats.name);
        await sshService.downloadFile(connection, remotePath, localFilePath);
        localFiles = [localFilePath];
    }

    if (localFiles.length === 0) {
        await fs.rm(localFolder, { recursive: true, force: true });
        throw new Error(ErrorCodes.SSH_IMPORT_NO_FILES);
    }

    const filesToProcess = localFiles.map((filePath) => ({
        path: filePath,
        originalname: path.basename(filePath),
        size: 0
    }));

    await createTrajectory({
        files: filesToProcess,
        teamId,
        userId,
        trajectoryName
    });

    parentPort?.postMessage({
        status: 'completed',
        jobId,
        result: null
    });
};

/**
 * Worker Entry Point
 */
const main = async () => {
    await mongoConnector();

    parentPort?.on('message', async (message: { job: SSHImportJob }) => {
        try {
            await processJob(message.job);
        } catch (error) {
            // TODO: Duplicated code
            logger.error(`[Worker #${process.pid}] Fatal Exception: ${error}`);
            parentPort?.postMessage({
                status: 'failed',
                jobId: message.job?.jobId || 'unknown',
                error: 'Fatal worker exception'
            });
        }
    });
};

main();