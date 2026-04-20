import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { promisify } from 'node:util';
import { dir as createTempDir } from 'tmp-promise';
import { type Job } from 'bullmq';

import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import { QueueService } from '@/core/queues/application/QueueService';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { SSH_IMPORT_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import { ObjectBucketName } from '@/contracts';
import type { DaemonConfig } from '@/core/config';
import type { GlbExporter } from '@/modules/trajectory/application/glb/GlbExporter';
import { FileExtractor } from '@/modules/trajectory/infrastructure/extraction/FileExtractor';
import { SSHConnection, type SSHConnectionConfig } from '@/modules/trajectory/infrastructure/ssh/SSHConnection';
import { parseTrajectoryMetadata } from '@/modules/trajectory/application/parsing/TrajectoryParserFactory';
import type {
    CompletedTrajectoryImportPayload,
    SSHImportJobPayload,
    TrajectoryImportPayload
} from '@/modules/trajectory/contracts/ssh-import-trajectory';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';
import type { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';
import { errorMessage, logAndSwallow } from '@/support/error/errorMessage';
import { compressFileWithZstd, toCompressedDumpObjectKey } from '@/support/serialization/storage-codec';
import type { JobIdentity } from '@/support/contracts/job-identity';
import { mapLimited } from '@/support/concurrency/map-limited';

const SSH_IMPORT_FRAME_CONCURRENCY = 4;

const scryptAsync = promisify(crypto.scrypt);

@Service('sshImportWorker')
export class SSHImportWorker extends BaseWorker<SSHImportJobPayload> {
    protected readonly queueName = SSH_IMPORT_QUEUE_NAME;
    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<JobIdentity>>;

    constructor(
        private readonly config: DaemonConfig,
        queueService: QueueService,
        private readonly minioService: MinioService,
        private readonly glbExporter: GlbExporter,
        daemonJobReporter: DaemonJobReporter,
        private readonly voltCloudConnection: VoltCloudConnection,
        private readonly sshConnection: SSHConnection,
        private readonly fileExtractor: FileExtractor
    ) {
        super({ queueService });
        this.buildStatusReporter = createLifecycleStatusReporter<JobIdentity>(
            {
                started: daemonJobReporter.reportSshImportStarted,
                completed: daemonJobReporter.reportSshImportCompleted,
                failed: daemonJobReporter.reportSshImportFailed
            },
            'SSH import'
        );
    }

    protected async process(payload: SSHImportJobPayload, _bullJob: Job<SSHImportJobPayload>): Promise<void> {
        const importContext = {
            teamClusterId: this.config.teamClusterId,
            daemonPassword: this.config.daemonPassword,
            trajectoryId: payload.trajectoryId,
            teamId: payload.teamId,
            userId: payload.userId
        };

        await fs.mkdir(DAEMON_PATHS.sshImport, { recursive: true });
        const workdirHandle = await createTempDir({
            tmpdir: DAEMON_PATHS.sshImport,
            prefix: `${this.sanitizeTempPrefix(payload.trajectoryId)}-`,
            unsafeCleanup: true
        });
        const workdir = workdirHandle.path;

        // SSH import has custom terminal reporting semantics (remote ack wins;
        // the local ssh-import status event is only a fallback). We supply a
        // no-op reportStatus to `withJobLifecycle` and dispatch status
        // ourselves so ordering/fallback behaviour is preserved.
        const reportFallbackStatus = this.buildStatusReporter({
            jobId: payload.jobId,
            teamId: payload.teamId,
            trajectoryId: payload.trajectoryId
        });

        await withJobLifecycle(
            {
                // Suppress the default `started` / `completed` / `failed`
                // reports — SSH import only emits them when the remote ack
                // report fails (see below).
                reportStatus: () => undefined,
                cleanup: async () => {
                    await workdirHandle.cleanup().catch(() => {});
                }
            },
            async () => {
                reportFallbackStatus('started');

                try {
                    const password = await this.decryptPassword(payload.encryptedPassword);
                    const connection: SSHConnectionConfig = {
                        host: payload.host,
                        port: payload.port ?? 22,
                        username: payload.username,
                        password
                    };

                    const stats = await this.sshConnection.getFileStats(connection, payload.remotePath);
                    if (!stats) {
                        throw new Error('SSH path not found');
                    }

                    const downloadRoot = path.join(workdir, 'download');
                    const downloadedFiles = stats.isDirectory
                        ? await this.sshConnection.downloadDirectory(connection, payload.remotePath, downloadRoot)
                        : [await (async () => {
                            const localFilePath = path.join(downloadRoot, stats.name);
                            await this.sshConnection.downloadFile(connection, payload.remotePath, localFilePath);
                            return localFilePath;
                        })()];

                    const extractedFiles = await this.fileExtractor.extractFiles(
                        downloadedFiles.map((filePath) => ({
                            path: filePath,
                            size: 0,
                            originalname: path.basename(filePath)
                        })),
                        path.join(workdir, 'extracted')
                    );

                    const frames: CompletedTrajectoryImportPayload['frames'] = await mapLimited(
                        extractedFiles,
                        SSH_IMPORT_FRAME_CONCURRENCY,
                        async (file) => {
                            const metadata = await parseTrajectoryMetadata(file.path);
                            const objectKey = toCompressedDumpObjectKey(payload.trajectoryId, metadata.timestep);
                            const compressedPath = `${file.path}.zst`;

                            try {
                                await compressFileWithZstd(file.path, compressedPath);
                                const stat = await fs.stat(compressedPath);
                                await this.minioService.putObjectStream({
                                    bucket: ObjectBucketName.Dumps,
                                    objectKey,
                                    stream: createReadStream(compressedPath),
                                    size: stat.size,
                                    metadata: {
                                        'Content-Type': 'application/zstd',
                                        'Content-Encoding': 'zstd'
                                    }
                                });
                            } finally {
                                await fs.unlink(compressedPath).catch(() => {});
                            }

                            await this.glbExporter.preprocessTrajectory({
                                teamId: payload.teamId,
                                trajectoryId: payload.trajectoryId,
                                timestep: metadata.timestep,
                                objectKey
                            });

                            return {
                                timestep: metadata.timestep,
                                natoms: metadata.natoms,
                                simulationCell: metadata.simulationCell,
                                size: file.size
                            };
                        }
                    );

                    const reported = await this.reportTrajectoryImport({ ...importContext, success: true, frames })
                        .catch((err: unknown) => {
                            logger.error(`Failed to report SSH import success jobId=${payload.jobId}: ${errorMessage(err)}`);
                            return false;
                        });

                    if (!reported) {
                        reportFallbackStatus('completed');
                    }
                } catch (error) {
                    if (!(error instanceof Error)) {
                        throw error;
                    }

                    logger.error(`SSH import failed trajectoryId=${payload.trajectoryId}: ${error.message}`);
                    const reported = await this.reportTrajectoryImport({
                        ...importContext,
                        success: false,
                        failureCode: 'SSH::Import::Error',
                        failureDetails: error.message
                    }).catch((err: unknown) => {
                        logger.error(`Failed to report SSH import failure jobId=${payload.jobId}: ${errorMessage(err)}`);
                        return false;
                    });

                    if (!reported) {
                        reportFallbackStatus('failed', error.message);
                    }

                    throw error;
                }
            }
        );
    }

    private async decryptPassword(value: string): Promise<string> {
        if (!process.env.SSH_ENCRYPTION_KEY) {
            throw new Error('SSH_ENCRYPTION_KEY environment variable is required');
        }

        const [ivB64, encrypted, authTagB64] = value.split(':');
        const key = await scryptAsync(process.env.SSH_ENCRYPTION_KEY, 'Volt-ssh', 32) as Buffer;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    private async reportTrajectoryImport(payload: TrajectoryImportPayload): Promise<boolean> {
        const queued = await this.voltCloudConnection.sendBackgroundServerCommand('trajectory.import-complete', payload, {
            dedupeKey: `trajectory.import:${payload.trajectoryId}:${payload.success ? 'completed' : 'failed'}`
        });
        if (queued !== undefined) {
            return true;
        }

        const direct = await this.voltCloudConnection.sendServerCommand('trajectory.import-complete', payload);
        return direct !== undefined;
    }

    private sanitizeTempPrefix(value: string): string {
        return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
    }
}
