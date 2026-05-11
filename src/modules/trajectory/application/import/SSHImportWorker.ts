import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { dir as createTempDir } from 'tmp-promise';
import { type Job } from 'bullmq';

import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { QueueService } from '@/core/queues/application/QueueService';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { SSH_IMPORT_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { DaemonConfig } from '@/core/config';
import type { GlbExporter } from '@/modules/trajectory/application/glb/GlbExporter';
import type { TrajectoryFrameStore } from '@/modules/trajectory/application/storage/TrajectoryFrameStore';
import { FileExtractor } from '@/modules/trajectory/infrastructure/extraction/FileExtractor';
import { SSHConnection, type SSHConnectionConfig } from '@/modules/trajectory/infrastructure/ssh/SSHConnection';
import { parseTrajectoryMetadata } from '@/modules/trajectory/application/parsing/TrajectoryParserFactory';
import type {
    CompletedTrajectoryImportPayload,
    SSHImportJobPayload,
    TrajectoryImportPayload
} from '@/modules/trajectory/contracts/ssh-import-trajectory';
import type { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';
import { errorMessage } from '@/support/error/errorMessage';
import { sanitizeFileName } from '@/support/fs/sanitize-file-name';
import { mapLimited } from '@/support/concurrency/map-limited';

const SSH_IMPORT_FRAME_CONCURRENCY = 4;

const scryptAsync = promisify(crypto.scrypt);

@Service('sshImportWorker')
export class SSHImportWorker extends BaseWorker<SSHImportJobPayload> {
    protected readonly queueName = SSH_IMPORT_QUEUE_NAME;

    constructor(
        private readonly config: DaemonConfig,
        queueService: QueueService,
        private readonly glbExporter: GlbExporter,
        private readonly voltCloudConnection: VoltCloudConnection,
        private readonly sshConnection: SSHConnection,
        private readonly fileExtractor: FileExtractor,
        private readonly trajectoryFrameStore: TrajectoryFrameStore
    ) {
        super({ queueService });
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
            prefix: `${sanitizeFileName(payload.trajectoryId, '')}-`,
            unsafeCleanup: true
        });
        const workdir = workdirHandle.path;

        await withJobLifecycle(
            {
                reportStatus: () => undefined,
                cleanup: async () => {
                    await workdirHandle.cleanup().catch(() => {});
                }
            },
            async () => {
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

                    const parsedFrames = await mapLimited(
                        extractedFiles,
                        SSH_IMPORT_FRAME_CONCURRENCY,
                        async (file) => {
                            const metadata = await parseTrajectoryMetadata(file.path);
                            return {
                                timestep: metadata.timestep,
                                natoms: metadata.natoms,
                                simulationCell: metadata.simulationCell,
                                size: file.size,
                                dumpPath: file.path
                            };
                        }
                    );

                    await this.trajectoryFrameStore.ingest({
                        trajectoryId: payload.trajectoryId,
                        ownerClusterId: this.config.teamClusterId,
                        frames: parsedFrames.map((frame) => ({
                            timestep: frame.timestep,
                            dumpPath: frame.dumpPath
                        }))
                    });

                    const frames: CompletedTrajectoryImportPayload['frames'] = parsedFrames.map((frame) => ({
                        timestep: frame.timestep,
                        natoms: frame.natoms,
                        simulationCell: frame.simulationCell,
                        size: frame.size
                    }));

                    for (const frame of parsedFrames) {
                        await this.glbExporter.preprocessTrajectory({
                            teamId: payload.teamId,
                            trajectoryId: payload.trajectoryId,
                            timestep: frame.timestep,
                            ownerClusterId: this.config.teamClusterId
                        });
                    }

                    await this.reportTrajectoryImport({ ...importContext, success: true, frames });
                } catch (error) {
                    if (!(error instanceof Error)) {
                        throw error;
                    }

                    logger.error(`SSH import failed trajectoryId=${payload.trajectoryId}: ${error.message}`);
                    try {
                        await this.reportTrajectoryImport({
                            ...importContext,
                            success: false,
                            failureCode: 'SSH::Import::Error',
                            failureDetails: error.message
                        });
                    } catch (reportError: unknown) {
                        logger.error(`Failed to report SSH import failure jobId=${payload.jobId}: ${errorMessage(reportError)}`);
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

    private async reportTrajectoryImport(payload: TrajectoryImportPayload): Promise<void> {
        await this.voltCloudConnection.sendServerCommand('trajectory.import-complete', payload);
    }
}
