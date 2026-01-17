import "reflect-metadata";
import logger from '@/src/shared/infrastructure/logger';
import { SSH_CONN_TOKENS } from '@/src/modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionService } from '@/src/modules/ssh/domain/ports/ISSHConnectionService';
import { container } from 'tsyringe';
import { ISSHConnectionRepository } from '../../domain/ports/ISSHConnectionRepository';
import Job from '@/src/modules/jobs/domain/entities/Job';
import BaseWorker from '@/src/shared/infrastructure/workers/BaseWorker';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { registerDependencies } from '@/src/core/di';

export default class SSHImportWorker extends BaseWorker<Job> {
    private sshService!: ISSHConnectionService;
    private sshRepository!: ISSHConnectionRepository;

    protected async setup(): Promise<void> {
        registerDependencies();
        await this.connectDB();
        this.sshService = container.resolve(SSH_CONN_TOKENS.SSHConnectionService);
        this.sshRepository = container.resolve(SSH_CONN_TOKENS.SSHConnectionRepository);
    }

    protected async perform(job: Job): Promise<void> {
        const { jobId, teamId, metadata } = job.props;
        const { sshConnectionId, remotePath, userId } = metadata || {};

        if (!sshConnectionId || !remotePath || !userId) {
            throw new Error('Missing required job metadata: sshConnectionId, remotePath, or userId');
        }

        try {
            // TODO: Maybe UseCase?
            const connection = await this.sshRepository.findByIdWithCredentials(sshConnectionId);
            if (!connection) throw new Error(ErrorCodes.SSH_CONNECTION_NOT_FOUND);

            const fileStats = await this.sshService.getFileStats(connection, remotePath);
            if (!fileStats) throw new Error(ErrorCodes.SSH_PATH_NOT_FOUND);

            let localFiles: string[] = [];
            const trajectoryName = fileStats.name;

            const tempBaseDir = process.env.TEMP_DIR || '/tmp';
            const localFolder = path.join(tempBaseDir, 'imports', jobId);
            await fs.mkdir(localFolder, { recursive: true });

            if (fileStats.isDirectory) {
                localFiles = await this.sshService.downloadDirectory(
                    connection,
                    remotePath,
                    localFolder,
                    (progress) => {
                        const percentage = progress.percent || 0;
                        this.sendMessage({
                            jobId,
                            status: 'progress',
                            progress: percentage,
                            message: `Downloading ${progress.downloadedBytes} of ${progress.totalBytes} b(${percentage} %)`
                        });
                    }
                );
            } else {
                const localFilePath = path.join(localFolder, fileStats.name);
                await this.sshService.downloadFile(connection, remotePath, localFilePath);
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

            logger.info(`@ssh-import-worker - #${process.pid}] ssh import job ${jobId} completed with ${localFiles.length} files`);
        } catch (error: any) {
            logger.error(`@ssh-import-worker - #${process.pid}] ssh import job ${jobId} failed: ${error.message} `);
            this.sendMessage({
                status: 'failed',
                jobId,
                error: error.message
            });
        }
    }
};

BaseWorker.start(SSHImportWorker);