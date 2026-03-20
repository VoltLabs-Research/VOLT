import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { isRetryableTeamClusterTransportError } from '@modules/team-cluster/infrastructure/services/TeamClusterTransportError';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { WorkerFailureError, createWorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { randomUUID } from 'node:crypto';

import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { FileHandle } from 'node:fs/promises';

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

enum UploadCompressionMode {
    Direct = 'direct',
    Chunked = 'chunked'
};

interface DirectCompressedPayload {
    mode: UploadCompressionMode.Direct;
    compressedDump: Buffer;
    compressedSize: number;
};

interface ChunkedCompressedPayload {
    mode: UploadCompressionMode.Chunked;
    chunkDirectoryPath: string;
    compressedSize: number;
    totalChunks: number;
};

type PreparedCompressedPayload = DirectCompressedPayload | ChunkedCompressedPayload;

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
            TEAM_CLUSTER_DAEMON_COMMAND.object.upload,
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
        const objectKey = this.dumpStorage.getObjectName(trajectoryId, String(timestep));
        const preparedPayload = await this.prepareCompressedPayload(localPath, objectKey);

        try {
            if (preparedPayload.mode === UploadCompressionMode.Direct) {
                await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.upload, {
                    bucket: SYS_BUCKETS.DUMPS,
                    objectKey,
                    content: preparedPayload.compressedDump.toString('base64'),
                    encoding: 'base64',
                    metadata: {
                        'Content-Type': 'application/gzip',
                        'Content-Encoding': 'gzip'
                    }
                });
                return;
            }

            await this.uploadChunked(
                teamClusterId,
                preparedPayload.chunkDirectoryPath,
                preparedPayload.compressedSize,
                preparedPayload.totalChunks,
                objectKey
            );
        } finally {
            if (preparedPayload.mode === UploadCompressionMode.Chunked) {
                await fs.rm(preparedPayload.chunkDirectoryPath, { force: true, recursive: true });
            }
        }
    }

    /**
     * Gzips the dump as a stream and only keeps compressed bytes in memory
     * while the payload stays within the direct-upload threshold.
     */
    private async prepareCompressedPayload(
        localPath: string,
        objectKey: string
    ): Promise<PreparedCompressedPayload> {
        const gzipStream = createReadStream(localPath).pipe(zlib.createGzip({
            level: zlib.constants.Z_BEST_SPEED
        }));
        const inMemoryChunks: Buffer[] = [];
        let inMemorySize = 0;
        let compressedSize = 0;
        let chunkDirectoryPath: string | undefined;
        let chunkFile: FileHandle | undefined;
        let currentChunkSize = 0;
        let totalChunks = 0;

        const closeChunkFile = async (): Promise<void> => {
            if (!chunkFile) {
                return;
            }

            await chunkFile.close();
            chunkFile = undefined;
            currentChunkSize = 0;
        };

        const startChunkedWrite = async (): Promise<void> => {
            if (chunkDirectoryPath) {
                return;
            }

            chunkDirectoryPath = await fs.mkdtemp(join(tmpdir(), 'trajectory-dump-'));

            logger.info(
                `@cloud-upload-processor: switching to streamed chunked upload objectKey=${objectKey} compressedBytesBuffered=${inMemorySize}`
            );

            for (const inMemoryChunk of inMemoryChunks) {
                await writeCompressedChunk(inMemoryChunk);
            }

            inMemoryChunks.length = 0;
            inMemorySize = 0;
        };

        const writeCompressedChunk = async (chunk: Buffer): Promise<void> => {
            let offset = 0;

            while (offset < chunk.length) {
                if (!chunkDirectoryPath) {
                    throw new Error('Chunk directory must exist before writing chunked upload data.');
                }

                if (!chunkFile) {
                    const chunkPath = join(chunkDirectoryPath, `${String(totalChunks).padStart(8, '0')}.part`);
                    chunkFile = await fs.open(chunkPath, 'w');
                }

                const writableBytes = Math.min(CHUNK_SIZE - currentChunkSize, chunk.length - offset);
                const chunkSlice = chunk.subarray(offset, offset + writableBytes);

                await chunkFile.write(chunkSlice);

                currentChunkSize += writableBytes;
                offset += writableBytes;

                if (currentChunkSize === CHUNK_SIZE) {
                    totalChunks += 1;
                    await closeChunkFile();
                }
            }
        };

        try {
            for await (const outputChunk of gzipStream) {
                const chunk = Buffer.isBuffer(outputChunk) ? outputChunk : Buffer.from(outputChunk);
                compressedSize += chunk.length;

                if (!chunkDirectoryPath && inMemorySize + chunk.length <= DIRECT_UPLOAD_THRESHOLD) {
                    inMemoryChunks.push(chunk);
                    inMemorySize += chunk.length;
                    continue;
                }

                await startChunkedWrite();
                await writeCompressedChunk(chunk);
            }

            if (!chunkDirectoryPath) {
                return {
                    mode: UploadCompressionMode.Direct,
                    compressedDump: Buffer.concat(inMemoryChunks, compressedSize),
                    compressedSize
                };
            }

            if (chunkFile) {
                totalChunks += 1;
                await closeChunkFile();
            }

            return {
                mode: UploadCompressionMode.Chunked,
                chunkDirectoryPath,
                compressedSize,
                totalChunks
            };
        } catch (error) {
            await closeChunkFile();

            if (chunkDirectoryPath) {
                await fs.rm(chunkDirectoryPath, { force: true, recursive: true });
            }

            throw error;
        }
    }

    /**
     * Streams a large compressed file in 512 KB chunks and sends them to
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
        chunkDirectoryPath: string,
        compressedSize: number,
        totalChunks: number,
        objectKey: string
    ): Promise<void> {
        const transferId = randomUUID();
        let uploadInitialized = false;

        logger.info(
            `@cloud-upload-processor: starting chunked upload transferId=${transferId} ` +
            `compressedSize=${compressedSize} chunks=${totalChunks} objectKey=${objectKey}`
        );

        try {
            // Phase 1 — init
            await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.uploadInit, {
                transferId,
                bucket: SYS_BUCKETS.DUMPS,
                objectKey,
                totalChunks,
                metadata: {
                    'Content-Type': 'application/gzip',
                    'Content-Encoding': 'gzip'
                }
            });
            uploadInitialized = true;

            // Phase 2 — send chunks sequentially
            for (let index = 0; index < totalChunks; index += 1) {
                const chunkPath = join(chunkDirectoryPath, `${String(index).padStart(8, '0')}.part`);
                const chunk = await fs.readFile(chunkPath);

                if (chunk.length === 0) {
                    throw new Error(`Compressed dump chunk is empty index=${index} path=${chunkPath}`);
                }

                if (chunk.length > CHUNK_SIZE) {
                    throw new Error(`Compressed dump chunk exceeds size limit index=${index} size=${chunk.length}`);
                }

                if (index < totalChunks - 1 && chunk.length !== CHUNK_SIZE) {
                    throw new Error(`Compressed dump chunk has unexpected size index=${index} expected=${CHUNK_SIZE} actual=${chunk.length}`);
                }

                if (index === totalChunks - 1) {
                    const finalChunkSize = compressedSize - (index * CHUNK_SIZE);

                    if (chunk.length !== finalChunkSize) {
                        throw new Error(`Compressed dump final chunk has unexpected size index=${index} expected=${finalChunkSize} actual=${chunk.length}`);
                    }
                }

                await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.uploadChunk, {
                    transferId,
                    index,
                    data: chunk.toString('base64')
                });
            }

            logger.info(
                `@cloud-upload-processor: uploaded chunked payload transferId=${transferId} chunks=${totalChunks} objectKey=${objectKey}`
            );

            // Phase 3 — commit
            await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.uploadCommit, {
                transferId
            });

            logger.info(`@cloud-upload-processor: chunked upload committed transferId=${transferId}`);
        } catch (error) {
            if (uploadInitialized) {
                await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.uploadAbort, {
                    transferId
                }).catch((abortError) => {
                    logger.warn({
                        abortError,
                        objectKey,
                        teamClusterId,
                        transferId
                    }, '@cloud-upload-processor: failed to abort chunked upload transfer');
                });
            }

            throw error;
        }
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
