import { createReadStream } from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import type { ObjectUploadLifecycleService } from '@/modules/platform/services/ObjectUploadLifecycleService';
import type { MinioService } from '@/modules/platform/services/MinioService';
import { ObjectBucketName } from '@/shared/contracts';

interface ChunkedTransfer {
    bucket: ObjectBucketName;
    objectKey: string;
    totalChunks: number;
    metadata?: Record<string, string>;
    tempPath: string;
    receivedCount: number;
    nextChunkIndex: number;
    totalSize: number;
    lastActivityAt: number;
    isCommitting: boolean;
};

interface InitializeChunkedUploadInput {
    transferId: string;
    bucket: ObjectBucketName;
    objectKey: string;
    totalChunks: number;
    metadata?: Record<string, string>;
};

interface AppendChunkInput {
    transferId: string;
    index: number;
    data: string;
};

interface CommitChunkedUploadInput {
    transferId: string;
};

interface AbortChunkedUploadInput {
    transferId: string;
};

interface AppendChunkResult {
    index: number;
};

interface AbortChunkedUploadResult {
    aborted: boolean;
    objectKey?: string;
    transferId: string;
};

interface ChunkedObjectUploadService {
    initializeTransfer(input: InitializeChunkedUploadInput): Promise<void>;
    appendChunk(input: AppendChunkInput): Promise<AppendChunkResult>;
    commitTransfer(input: CommitChunkedUploadInput): Promise<void>;
    abortTransfer(input: AbortChunkedUploadInput): Promise<AbortChunkedUploadResult>;
};

interface ChunkedObjectUploadServiceDependencies {
    minioService: MinioService;
    objectUploadLifecycleService: ObjectUploadLifecycleService;
};

const TRANSFER_TTL_MS = 5 * 60 * 1000;
const TRANSFER_SWEEP_INTERVAL_MS = 60 * 1000;
const BASE64_CHUNK_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const cleanupTransferFile = async (transfer: ChunkedTransfer): Promise<void> => {
    await fsPromises.unlink(transfer.tempPath).catch(() => {});
};

const refreshTransferActivity = (transfer: ChunkedTransfer): void => {
    transfer.lastActivityAt = Date.now();
};

export const createChunkedObjectUploadService = (
    deps: ChunkedObjectUploadServiceDependencies
): ChunkedObjectUploadService => {
    const chunkedTransfers = new Map<string, ChunkedTransfer>();

    const cleanupTransfer = async (transferId: string, transfer: ChunkedTransfer): Promise<void> => {
        chunkedTransfers.delete(transferId);
        await cleanupTransferFile(transfer);
    };

    const sweepInterval = setInterval(() => {
        const now = Date.now();

        for (const [transferId, transfer] of chunkedTransfers) {
            if (transfer.isCommitting) {
                refreshTransferActivity(transfer);
                continue;
            }

            if (now - transfer.lastActivityAt > TRANSFER_TTL_MS) {
                chunkedTransfers.delete(transferId);
                cleanupTransferFile(transfer).catch(() => {});
                logger.warn(
                    { transferId, objectKey: transfer.objectKey },
                    'Chunked transfer expired - cleaned up stale state and temp file'
                );
            }
        }
    }, TRANSFER_SWEEP_INTERVAL_MS);
    sweepInterval.unref();

    return {
        async initializeTransfer(input) {
            if (input.totalChunks <= 0 || input.totalChunks > 100_000) {
                throw new Error('totalChunks must be between 1 and 100000');
            }

            if (chunkedTransfers.has(input.transferId)) {
                throw new Error(`Transfer ${input.transferId} already exists`);
            }

            const tempPath = path.join(DAEMON_PATHS.analysisOutput, `chunked-upload-${input.transferId}`);
            await fsPromises.mkdir(path.dirname(tempPath), { recursive: true });
            await fsPromises.writeFile(tempPath, Buffer.alloc(0));

            chunkedTransfers.set(input.transferId, {
                bucket: input.bucket,
                objectKey: input.objectKey,
                totalChunks: input.totalChunks,
                metadata: input.metadata,
                tempPath,
                receivedCount: 0,
                nextChunkIndex: 0,
                totalSize: 0,
                lastActivityAt: Date.now(),
                isCommitting: false
            });

            logger.info(
                {
                    transferId: input.transferId,
                    objectKey: input.objectKey,
                    totalChunks: input.totalChunks,
                    tempPath
                },
                'Chunked upload initialized (disk-spooled)'
            );
        },

        async appendChunk(input) {
            const transfer = chunkedTransfers.get(input.transferId);
            if (!transfer) {
                throw new Error(`Unknown transfer: ${input.transferId}`);
            }

            if (input.index < 0 || input.index >= transfer.totalChunks) {
                throw new Error(`Chunk index ${input.index} out of range [0, ${transfer.totalChunks})`);
            }

            if (input.index !== transfer.nextChunkIndex) {
                throw new Error(
                    `Chunk index ${input.index} arrived out of order; expected ${transfer.nextChunkIndex}`
                );
            }

            if (!BASE64_CHUNK_PATTERN.test(input.data)) {
                throw new Error(`Chunk index ${input.index} is not valid base64 data`);
            }

            const chunkBuffer = Buffer.from(input.data, 'base64');
            await fsPromises.appendFile(transfer.tempPath, chunkBuffer);
            transfer.receivedCount += 1;
            transfer.nextChunkIndex += 1;
            transfer.totalSize += chunkBuffer.length;
            refreshTransferActivity(transfer);

            return {
                index: input.index
            };
        },

        async commitTransfer(input) {
            const transfer = chunkedTransfers.get(input.transferId);
            if (!transfer) {
                throw new Error(`Unknown transfer: ${input.transferId}`);
            }

            if (transfer.receivedCount !== transfer.totalChunks) {
                throw new Error(
                    `Transfer ${input.transferId} incomplete: received ${transfer.receivedCount}/${transfer.totalChunks} chunks`
                );
            }

            transfer.isCommitting = true;
            refreshTransferActivity(transfer);

            try {
                const tempStats = await fsPromises.stat(transfer.tempPath);
                refreshTransferActivity(transfer);

                if (tempStats.size !== transfer.totalSize) {
                    logger.error(
                        {
                            transferId: input.transferId,
                            objectKey: transfer.objectKey,
                            expectedSize: transfer.totalSize,
                            actualFileSize: tempStats.size,
                            receivedChunks: transfer.receivedCount,
                            totalChunks: transfer.totalChunks
                        },
                        'DIAG: Temp file size mismatch before MinIO upload - data may be corrupted'
                    );
                    throw new Error(`Transfer ${input.transferId} temp file size mismatch before upload`);
                }

                await deps.minioService.putObjectStream({
                    bucket: transfer.bucket,
                    objectKey: transfer.objectKey,
                    stream: createReadStream(transfer.tempPath),
                    size: transfer.totalSize,
                    metadata: transfer.metadata
                });
                refreshTransferActivity(transfer);

                await deps.objectUploadLifecycleService.verifyChunkedUpload({
                    transferId: input.transferId,
                    bucket: transfer.bucket,
                    objectKey: transfer.objectKey,
                    uploadedSize: transfer.totalSize
                });
            } finally {
                transfer.isCommitting = false;
                await cleanupTransfer(input.transferId, transfer);
            }

            deps.objectUploadLifecycleService.emitUploadCompleted({
                bucket: transfer.bucket,
                objectKey: transfer.objectKey
            });

            logger.info(
                {
                    transferId: input.transferId,
                    objectKey: transfer.objectKey,
                    totalSize: transfer.totalSize
                },
                'Chunked upload committed to MinIO (streamed from disk)'
            );
        },

        async abortTransfer(input) {
            const transfer = chunkedTransfers.get(input.transferId);

            if (!transfer) {
                return {
                    aborted: false,
                    transferId: input.transferId
                };
            }

            await cleanupTransfer(input.transferId, transfer);

            logger.info(
                { transferId: input.transferId, objectKey: transfer.objectKey },
                'Chunked upload aborted and cleaned up'
            );

            return {
                aborted: true,
                objectKey: transfer.objectKey,
                transferId: input.transferId
            };
        }
    };
};
