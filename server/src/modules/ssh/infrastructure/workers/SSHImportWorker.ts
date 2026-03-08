import "reflect-metadata";
import { registerAllDependencies } from '@core/bootstrap/register-deps';
import logger from '@shared/infrastructure/logger';
import { SSH_CONN_TOKENS } from '@modules/ssh/infrastructure/di/SSHConnectionTokens';
import { ISSHConnectionService } from '@modules/ssh/domain/port/ISSHConnectionService';
import { container } from 'tsyringe';
import { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import Job from '@modules/jobs/domain/entities/Job';
import BaseWorker from '@shared/infrastructure/workers/BaseWorker';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    createWorkerFailureEnvelope,
    normalizeWorkerFailureEnvelope,
    WorkerFailureError
} from '@shared/infrastructure/workers/WorkerFailureEnvelope';

registerAllDependencies();

interface SSHImportJobMetadata {
    sshConnectionId?: string;
    remotePath?: string;
    userId?: string;
}

export default class SSHImportWorker extends BaseWorker<Job> {
    private sshService!: ISSHConnectionService;
    private sshRepository!: ISSHConnectionRepository;

    protected async setup(): Promise<void> {
        await this.connectDB();
        this.sshService = container.resolve(SSH_CONN_TOKENS.SSHConnectionService);
        this.sshRepository = container.resolve(SSH_CONN_TOKENS.SSHConnectionRepository);
    }

    protected async perform(job: Job): Promise<void> {
        const { jobId, teamId } = job.props;
        const metadata = job.props.metadata as SSHImportJobMetadata | undefined;
        const sshConnectionId = metadata?.sshConnectionId;
        const remotePath = metadata?.remotePath;
        const userId = metadata?.userId;

        if (!sshConnectionId || !remotePath || !userId) {
            throw new WorkerFailureError(createWorkerFailureEnvelope({
                code: ErrorCodes.WORKER_FAILURE,
                details: 'Missing required job metadata: sshConnectionId, remotePath, or userId'
            }));
        }

        try {
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
        } catch (error: unknown) {
            const failure = normalizeWorkerFailureEnvelope({
                error,
                fallbackCode: ErrorCodes.SSH_IMPORT_ERROR
            });
            const failureDetails = failure.details || failure.message;
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error(`@ssh-import-worker - #${process.pid}] ssh import job ${jobId} failed: ${failureDetails}${errorStack ? `\nStack: ${errorStack}` : ''}`);
            this.sendFailure(jobId, failure);
        }
    }
};

BaseWorker.start(SSHImportWorker);
