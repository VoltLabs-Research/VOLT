import { ObjectBucketName } from '@/shared/contracts';
import { DAEMON_PATHS } from '@/core/paths';
import { MinioService } from '@/modules/platform/services';
import { RedisConnectionService } from '@/modules/platform/services';
import { QueueService } from '@/modules/platform/services';
import { SSH_IMPORT_QUEUE_NAME } from '@/modules/platform/services';
import type { GlbExporterService } from '@/modules/trajectory-native/services';
import { FileExtractorService } from './FileExtractorService';
import { SSHConnectionService, type SSHConnectionConfig } from './SSHConnectionService';
import { TrajectoryParserFactory } from './TrajectoryParserFactory';
import { logger } from '@/core/logger';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Worker } from 'bullmq';
import type { DaemonConfig } from '@/core/config';

interface SSHImportJobPayload extends Record<string, unknown> {
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

export class SSHImportWorkerService {
    private worker: Worker<SSHImportJobPayload> | null = null;

    constructor(
        private readonly config: DaemonConfig,
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly minioService: MinioService,
        private readonly glbExporterService: GlbExporterService,
        private readonly sshConnectionService: SSHConnectionService,
        private readonly fileExtractorService: FileExtractorService
    ) {
    }

    start(): void {
        if (this.worker) {
            return;
        }

        this.worker = this.queueService.createWorker<SSHImportJobPayload>(SSH_IMPORT_QUEUE_NAME, async (job) => {
            await this.processJob(job);
        });
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

    private async processJob(job: SSHImportJobPayload): Promise<void> {
        const workdir = path.join(DAEMON_PATHS.sshImport, `${job.trajectoryId}-${Date.now()}`);
        const jobId = `ssh-import:${job.trajectoryId}`;

        try {
            await fs.mkdir(workdir, { recursive: true });

            await this.redisConnectionService.projectJobStatus({
                jobId,
                teamId: job.teamId,
                queueType: SSH_IMPORT_QUEUE_NAME,
                status: 'running',
                metadata: {
                    trajectoryId: job.trajectoryId,
                    trajectoryName: job.trajectoryName
                }
            });

            const password = this.decryptPassword(job.encryptedPassword);
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
                const objectKey = `trajectory-${job.trajectoryId}/timestep-${metadata.timestep}.dump.gz`;
                const dumpBuffer = await fs.readFile(file.path);
                const compressedDump = zlib.gzipSync(dumpBuffer, {
                    level: zlib.constants.Z_BEST_SPEED
                });

                await this.minioService.putObject({
                    bucket: ObjectBucketName.Dumps,
                    objectKey,
                    body: compressedDump,
                    metadata: {
                        'Content-Type': 'application/gzip',
                        'Content-Encoding': 'gzip'
                    }
                });

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
                    trajectoryId: job.trajectoryId,
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

            await this.reportTrajectoryImport({
                teamClusterId: this.config.teamClusterId,
                daemonPassword: this.config.daemonPassword,
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                teamId: job.teamId,
                userId: job.userId,
                success: true,
                frames
            });

            await this.redisConnectionService.projectJobStatus({
                jobId,
                teamId: job.teamId,
                queueType: SSH_IMPORT_QUEUE_NAME,
                status: 'completed',
                metadata: {
                    trajectoryId: job.trajectoryId,
                    trajectoryName: job.trajectoryName
                }
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ err: error, trajectoryId: job.trajectoryId }, 'SSH import failed');

            await this.reportTrajectoryImport({
                teamClusterId: this.config.teamClusterId,
                daemonPassword: this.config.daemonPassword,
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                teamId: job.teamId,
                userId: job.userId,
                success: false,
                failureCode: 'SSH::Import::Error',
                failureDetails: message
            });

            await this.redisConnectionService.projectJobStatus({
                jobId,
                teamId: job.teamId,
                queueType: SSH_IMPORT_QUEUE_NAME,
                status: 'failed',
                error: message,
                metadata: {
                    trajectoryId: job.trajectoryId,
                    trajectoryName: job.trajectoryName
                }
            });

            throw error instanceof Error ? error : new Error(message);
        } finally {
            await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
        }
    }

    private decryptPassword(value: string): string {
        if (!process.env.SSH_ENCRYPTION_KEY) {
            throw new Error('SSH_ENCRYPTION_KEY environment variable is required');
        }

        const [ivB64, encrypted, authTagB64] = value.split(':');
        if (!ivB64 || !encrypted || !authTagB64) {
            throw new Error('Invalid encrypted SSH password');
        }

        const key = crypto.scryptSync(process.env.SSH_ENCRYPTION_KEY, 'Volt-ssh', 32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    private async reportTrajectoryImport(payload: Record<string, unknown>): Promise<void> {
        const response = await fetch(`${this.config.voltCloudUrl}/api/v1/daemon/trajectory-import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Failed to report trajectory import: ${response.status} ${body}`.trim());
        }
    }
};
