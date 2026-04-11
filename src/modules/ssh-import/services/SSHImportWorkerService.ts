import { ObjectBucketName } from '@/shared/contracts';
import { DAEMON_PATHS } from '@/core/paths';
import { MinioService } from '@/modules/platform/services';
import { QueueService } from '@/modules/platform/services';
import { SSH_IMPORT_QUEUE_NAME } from '@/modules/platform/services';
import type { DaemonJobReporterService, SshImportJobStatus } from '@/modules/cloud-control/services';
import type { VoltCloudConnection } from '@/modules/cloud-control/services';
import type { GlbExporterService } from '@/modules/trajectory-native/services';
import { FileExtractorService } from './FileExtractorService';
import { SSHConnectionService } from './SSHConnectionService';
import { TrajectoryParserFactory } from './TrajectoryParserFactory';
import { isMemoryPressured } from '@/core/memory';
import { logger } from '@/core/logger';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { compressFileWithZstd, toCompressedDumpObjectKey } from '@/shared/utilities/storage-codec';
import path from 'node:path';
import zlib from 'node:zlib';
import { DelayedError } from 'bullmq';
import type { DaemonConfig } from '@/core/config';
import type { SSHConnectionConfig } from './SSHConnectionService';
import type { Job, Worker } from 'bullmq';

interface SSHImportJobPayload extends Record<string, unknown> {
    jobId: string;
    teamId: string;
    sshConnectionId: string;
    remotePath: string;
    userId: string;
    host: string;
    port?: number;
    username: string;
    encryptedPassword: string;
    trajectoryId: string;
    trajectoryName: string;
};

interface ImportedFrameRecord {
    timestep: number;
    natoms: number;
    simulationCell: Record<string, unknown> | null;
    size: number;
};

const scryptAsync = promisify(crypto.scrypt);

export class SSHImportWorkerService {
    private worker: Worker<SSHImportJobPayload> | null = null;

    constructor(
        private readonly config: DaemonConfig,
        private readonly queueService: QueueService,
        private readonly minioService: MinioService,
        private readonly glbExporterService: GlbExporterService,
        private readonly daemonJobReporterService: DaemonJobReporterService,
        private readonly voltCloudConnection: VoltCloudConnection,
        private readonly sshConnectionService: SSHConnectionService,
        private readonly fileExtractorService: FileExtractorService
    ) {
    }

    start(concurrency?: number): void {
        if (this.worker) {
            return;
        }

        this.worker = this.queueService.createWorker<SSHImportJobPayload>(
            SSH_IMPORT_QUEUE_NAME,
            async (job, bullJob) => {
                if (isMemoryPressured()) {
                    const delayMs = 30_000;
                    logger.warn(
                        { trajectoryId: job.trajectoryId, delayMs },
                        'Heap memory pressure detected — delaying SSH import job'
                    );
                    await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
                    throw new DelayedError();
                }

                await this.processJob(job);
            },
            {
                concurrency: concurrency ?? 1
            }
        );
        logger.info('SSHImportWorkerService started');
    }

    async stop(): Promise<void> {
        if (!this.worker) {
            return;
        }

        await this.worker.close();
        this.worker = null;
        logger.info('SSHImportWorkerService stopped');
    }

    setConcurrency(concurrency: number): void {
        if (!this.worker) {
            throw new Error('SSHImportWorkerService has not started');
        }

        this.worker.concurrency = concurrency;
        logger.info({ concurrency }, 'SSHImportWorkerService concurrency updated');
    }

    private async processJob(job: SSHImportJobPayload): Promise<void> {
        const workdir = path.join(DAEMON_PATHS.sshImport, `${job.trajectoryId}-${Date.now()}`);
        const jobId = job.jobId;

        try {
            await fs.mkdir(workdir, { recursive: true });
            await this.reportJobStatusBestEffort(job, 'running');

            const password = await this.decryptPassword(job.encryptedPassword);
            const connection: SSHConnectionConfig = {
                host: job.host,
                port: job.port || 22,
                username: job.username,
                password
            };

            const stats = await this.sshConnectionService.getFileStats(connection, job.remotePath);
            if (!stats) {
                throw new Error('SSH path not found');
            }

            const downloadRoot = path.join(workdir, 'download');
            let downloadedFiles: string[] = [];
            if (stats.isDirectory) {
                downloadedFiles = await this.sshConnectionService.downloadDirectory(connection, job.remotePath, downloadRoot);
            } else {
                const localFilePath = path.join(downloadRoot, stats.name);
                await this.sshConnectionService.downloadFile(connection, job.remotePath, localFilePath);
                downloadedFiles = [localFilePath];
            }

            const extractedFiles = await this.fileExtractorService.extractFiles(
                downloadedFiles.map((filePath) => ({
                    path: filePath,
                    size: 0,
                    originalname: path.basename(filePath)
                })),
                path.join(workdir, 'extracted')
            );

            const frames: ImportedFrameRecord[] = [];
            for (const file of extractedFiles) {
                const metadata = await TrajectoryParserFactory.parseMetadata(file.path);
                const objectKey = toCompressedDumpObjectKey(job.trajectoryId, metadata.timestep);
                const tempGzPath = `${file.path}.zst`;
                try {
                    await compressFileWithZstd(file.path, tempGzPath);
                    const gzStat = await fs.stat(tempGzPath);
                    await this.minioService.putObjectStream({
                        bucket: ObjectBucketName.Dumps,
                        objectKey,
                        stream: createReadStream(tempGzPath),
                        size: gzStat.size,
                        metadata: {
                            'Content-Type': 'application/zstd',
                            'Content-Encoding': 'zstd'
                        }
                    });
                } finally {
                    await fs.unlink(tempGzPath).catch(() => {});
                }

                logger.info(
                    {
                        filePath: file.path,
                        natoms: metadata.natoms,
                        objectKey,
                        sourceSizeBytes: file.size,
                        timestep: metadata.timestep,
                        trajectoryId: job.trajectoryId
                    },
                    'Starting native preprocessing for imported trajectory frame'
                );

                await this.glbExporterService.preprocessTrajectory({
                    teamId: job.teamId,
                    trajectoryId: job.trajectoryId,
                    trajectoryName: job.trajectoryName,
                    timestep: metadata.timestep,
                    objectKey
                });

                logger.info(
                    {
                        objectKey,
                        timestep: metadata.timestep,
                        trajectoryId: job.trajectoryId
                    },
                    'Finished native preprocessing for imported trajectory frame'
                );

                frames.push({
                    timestep: metadata.timestep,
                    natoms: metadata.natoms,
                    simulationCell: metadata.simulationCell,
                    size: file.size
                });
            }

            const wasReported = await this.reportTrajectoryImport({
                teamClusterId: this.config.teamClusterId,
                daemonPassword: this.config.daemonPassword,
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                teamId: job.teamId,
                userId: job.userId,
                success: true,
                frames
            }).catch((reportError) => {
                logger.error({ err: reportError, jobId, trajectoryId: job.trajectoryId }, 'Failed to report successful SSH import completion');
                return false;
            });

            if (wasReported === false) {
                await this.reportJobStatusBestEffort(job, 'completed');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ err: error, trajectoryId: job.trajectoryId }, 'SSH import failed');

            const wasReported = await this.reportTrajectoryImport({
                teamClusterId: this.config.teamClusterId,
                daemonPassword: this.config.daemonPassword,
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                teamId: job.teamId,
                userId: job.userId,
                success: false,
                failureCode: 'SSH::Import::Error',
                failureDetails: message
            }).catch((reportError) => {
                logger.error({ err: reportError, jobId, trajectoryId: job.trajectoryId }, 'Failed to report failed SSH import completion');
                return false;
            });

            if (wasReported === false) {
                await this.reportJobStatusBestEffort(job, 'failed', message);
            }

            throw error instanceof Error ? error : new Error(message);
        } finally {
            await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
        }
    }

    private async reportJobStatusBestEffort(
        job: SSHImportJobPayload,
        status: SshImportJobStatus,
        error?: string
    ): Promise<void> {
        try {
            await this.daemonJobReporterService.reportSshImportJobStatus({
                jobId: job.jobId,
                teamId: job.teamId,
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                status,
                error
            });
        } catch (reportError) {
            logger.error(
                {
                    err: reportError,
                    jobId: job.jobId,
                    status,
                    trajectoryId: job.trajectoryId
                },
                'Failed to report SSH import job status to cloud control'
            );
        }
    }

    private async decryptPassword(value: string): Promise<string> {
        if (!process.env.SSH_ENCRYPTION_KEY) {
            throw new Error('SSH_ENCRYPTION_KEY environment variable is required');
        }

        const [ivB64, encrypted, authTagB64] = value.split(':');
        if (!ivB64 || !encrypted || !authTagB64) {
            throw new Error('Invalid encrypted SSH password');
        }

        const key = await scryptAsync(process.env.SSH_ENCRYPTION_KEY, 'Volt-ssh', 32) as Buffer;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    private async reportTrajectoryImport(payload: Record<string, unknown>): Promise<boolean> {
        const queuedResult = await this.voltCloudConnection.sendBackgroundServerCommand('trajectory.import-complete', payload, {
            dedupeKey: `trajectory.import:${String(payload.trajectoryId)}:${payload.success === true ? 'completed' : 'failed'}`
        });

        if (typeof queuedResult !== 'undefined') {
            return true;
        }

        const directResult = await this.voltCloudConnection.sendServerCommand('trajectory.import-complete', payload);
        return typeof directResult !== 'undefined';
    }
};
