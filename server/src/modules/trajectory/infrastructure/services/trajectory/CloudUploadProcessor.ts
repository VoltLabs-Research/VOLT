import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { isRetryableTeamClusterTransportError } from '@modules/team-cluster/infrastructure/services/TeamClusterTransportError';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { WorkerFailureError, createWorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';

const gzipAsync = promisify(zlib.gzip);

/**
 * Compressed payloads at or below this threshold are sent as a single
 * `object.upload` message (legacy path). Larger payloads use chunked upload.
 */
const DIRECT_UPLOAD_THRESHOLD = 768 * 1024; // 768 KB compressed

/**
 * Each chunk carries 512 KB of binary data (~682 KB after base64 encoding),
 * well within the 10 MB `maxHttpBufferSize` configured on the Socket.IO server.
 */
const CHUNK_SIZE = 512 * 1024; // 512 KB binary per chunk

interface CloudUploadTask {
    trajectoryId: string;
    teamId: string;
    teamClusterId?: string;
    trajectoryName?: string;
    timestep: number;
    frameFilePath: string;
};

interface TeamClusterCommandClient {
    command(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<unknown>;
};

interface RetryOptions {
    maxAttempts: number;
    baseDelayMs: number;
};

const RETRY_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 500
};

const wait = async (delayMs: number): Promise<void> => {
    await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    });
};

@injectable()
export default class CloudUploadProcessor {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterCommandClient
    ) {}

    async process(task: CloudUploadTask): Promise<void> {
        const {
            trajectoryId,
            teamId,
            teamClusterId,
            trajectoryName,
            timestep,
            frameFilePath
        } = task;

        logger.info(`@cloud-upload-processor: uploading frame for GLB preprocess trajectoryId=${trajectoryId} timestep=${timestep} teamClusterId=${teamClusterId || 'none'} localPath=${frameFilePath}`);

        if (!teamClusterId) {
            throw new Error('Cloud upload requires a team cluster. No local native modules available.');
        }

        await this.executeWithTransportRetry(
            task,
            'object.upload',
            () => this.uploadDumpToTeamCluster(teamClusterId, trajectoryId, timestep, frameFilePath)
        );

        logger.info(`@cloud-upload-processor: uploaded dump for trajectoryId=${trajectoryId} timestep=${timestep}`);
    }

    private async uploadDumpToTeamCluster(
        teamClusterId: string,
        trajectoryId: string,
        timestep: number,
        localPath: string
    ): Promise<void> {
        const dumpBuffer = await fs.readFile(localPath);
        const compressedDump = await gzipAsync(dumpBuffer, {
            level: zlib.constants.Z_BEST_SPEED
        });
        const objectKey = this.dumpStorage.getObjectName(trajectoryId, String(timestep));

        if (compressedDump.length <= DIRECT_UPLOAD_THRESHOLD) {
            // Small payload — use the legacy single-message path.
            await this.teamClusterDaemonClient.command(teamClusterId, 'object.upload', {
                bucket: SYS_BUCKETS.DUMPS,
                objectKey,
                content: compressedDump.toString('base64'),
                encoding: 'base64',
                metadata: {
                    'Content-Type': 'application/gzip',
                    'Content-Encoding': 'gzip'
                }
            });
            return;
        }

        // Large payload — chunked upload protocol.
        await this.uploadChunked(teamClusterId, compressedDump, objectKey);
    }

    /**
     * Splits a large compressed buffer into 512 KB chunks and sends them to
     * the daemon via a three-phase protocol:
     *
     *   1. `object.upload.init`   — declares the transfer (bucket, objectKey, metadata)
     *   2. `object.upload.chunk`  — sends each chunk with its index
     *   3. `object.upload.commit` — signals completion; daemon reassembles & stores
     *
     * Each phase is a separate Socket.IO command with its own 30 s timeout,
     * so even very large files (hundreds of MB compressed) transfer reliably.
     */
    private async uploadChunked(
        teamClusterId: string,
        compressedDump: Buffer,
        objectKey: string
    ): Promise<void> {
        const transferId = randomUUID();
        const totalChunks = Math.ceil(compressedDump.length / CHUNK_SIZE);

        logger.info(
            `@cloud-upload-processor: starting chunked upload transferId=${transferId} ` +
            `compressedSize=${compressedDump.length} chunks=${totalChunks} objectKey=${objectKey}`
        );

        // Phase 1 — init
        await this.teamClusterDaemonClient.command(teamClusterId, 'object.upload.init', {
            transferId,
            bucket: SYS_BUCKETS.DUMPS,
            objectKey,
            totalChunks,
            metadata: {
                'Content-Type': 'application/gzip',
                'Content-Encoding': 'gzip'
            }
        });

        // Phase 2 — send chunks sequentially
        for (let index = 0; index < totalChunks; index += 1) {
            const start = index * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, compressedDump.length);
            const chunk = compressedDump.subarray(start, end);

            await this.teamClusterDaemonClient.command(teamClusterId, 'object.upload.chunk', {
                transferId,
                index,
                data: chunk.toString('base64')
            });
        }

        // Phase 3 — commit
        await this.teamClusterDaemonClient.command(teamClusterId, 'object.upload.commit', {
            transferId
        });

        logger.info(`@cloud-upload-processor: chunked upload committed transferId=${transferId}`);
    }

    /** Retries transient daemon transport failures before surfacing a terminal trajectory failure. */
    private async executeWithTransportRetry(
        task: CloudUploadTask,
        commandName: string,
        operation: () => Promise<void>
    ): Promise<void> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= RETRY_OPTIONS.maxAttempts; attempt += 1) {
            try {
                await operation();
                return;
            } catch (error) {
                lastError = error;

                if (!isRetryableTeamClusterTransportError(error)) {
                    throw error;
                }

                logger.warn({
                    attempt,
                    commandName,
                    maxAttempts: RETRY_OPTIONS.maxAttempts,
                    teamClusterId: task.teamClusterId,
                    timestep: task.timestep,
                    trajectoryId: task.trajectoryId
                }, `@cloud-upload-processor: transient daemon transport failure during ${commandName}`);

                if (attempt === RETRY_OPTIONS.maxAttempts) {
                    break;
                }

                await wait(RETRY_OPTIONS.baseDelayMs * attempt);
            }
        }

        throw new WorkerFailureError(createWorkerFailureEnvelope({
            code: ErrorCodes.TRAJECTORY_DAEMON_TRANSPORT_FAILED,
            details: lastError instanceof Error
                ? lastError.message
                : 'Trajectory daemon transport retries exhausted'
        }));
    }
};
