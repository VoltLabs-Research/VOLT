
import { BaseWorker } from './base-worker';
import { SSHImportJob } from '@/types/services/ssh-import-queue';
import { SSHConnection } from '@/models';
import { ErrorCodes } from '@/constants/error-codes';
import sshService from '@/services/ssh';
import tempFileManager from '@/services/temp-file-manager';
import * as fs from 'fs/promises';
import * as path from 'node:path';

class SSHImportWorker extends BaseWorker<SSHImportJob> {
    protected async setup(): Promise<void> {
        await this.connectDB();
    }

    protected async perform(job: SSHImportJob): Promise<void> {
        const { jobId, sshConnectionId, remotePath, teamId, userId } = job;

        const connection = await SSHConnection.findById(sshConnectionId).select('+encryptedPassword');
        if (!connection) throw new Error(ErrorCodes.SSH_CONNECTION_NOT_FOUND);

        const fileStats = await sshService.getFileStats(connection, remotePath);
        if (!fileStats) throw new Error(ErrorCodes.SSH_PATH_NOT_FOUND);

        let localFiles: string[] = [];
        const trajectoryName = fileStats.name || 'SSH Import';

        const tempBaseDir = tempFileManager.getDirPath('imports');
        const localFolder = path.join(tempBaseDir, jobId);

        if (fileStats.isDirectory) {
            localFiles = await sshService.downloadDirectory(
                connection,
                remotePath,
                localFolder,
                (progress) => {
                    const percentage = Math.round((progress.downloadedBytes / progress.totalBytes) * 100);
                    this.sendMessage({
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

        this.sendMessage({
            status: 'completed',
            jobId,
            result: {
                files: filesToProcess,
                teamId,
                userId,
                trajectoryName
            }
        });
    }
}

BaseWorker.start(SSHImportWorker);