import { errorMessage } from '@shared/application/utilities/error-message';
import { toTrajectoryFrameDumpObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { ErrorCodes } from '@core/constants/error-codes';
import { getConfig } from '@core/config/daemon';
import { getMinioService } from '@shared/infrastructure/storage/MinioService';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { getDaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { logger } from '@shared/infrastructure/logger';
import type { DaemonConfig } from '@core/config/daemon';
import type { LocalClusterObjectStoreGateway } from '@shared/contracts/types/cluster-object-store';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import type { DaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import { TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME } from '@core/constants/queue-names';
import type { FrameProcessingQueueJobPayload } from '@shared/contracts';
import { parseTrajectoryMetadata, type ParsedFrameMetadata } from '@modules/trajectory/services/parsing/TrajectoryParserFactory';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import { mapLimited } from '@shared/application/utilities/map-limited';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const INGEST_FRAME_CONCURRENCY = readPositiveIntegerEnv('TRAJECTORY_INGEST_CONCURRENCY') ?? 8;
const METADATA_READ_BYTES = readPositiveIntegerEnv('TRAJECTORY_METADATA_READ_BYTES') ?? 4 * 1024 * 1024;
const DEFAULT_FRAME_JOB_ATTEMPTS = readPositiveIntegerEnv('TRAJECTORY_FRAME_JOB_ATTEMPTS') ?? 3;
const DEFAULT_FRAME_JOB_BACKOFF_MS = readPositiveIntegerEnv('TRAJECTORY_FRAME_JOB_BACKOFF_MS') ?? 2000;
const SESSION_TTL_SECONDS = 86400;
const INGEST_BUCKET = ObjectBucketName.Dumps;
const ZIP_ENTRY_JUNK_BASENAMES = new Set(['__MACOSX', '.DS_Store', 'Thumbs.db']);

interface TrajectoryIngestStagedObject {
    objectKey: string;
    originalName: string;
    size: number;
    parts?: TrajectoryIngestStagedPart[];
}

interface TrajectoryIngestStagedPart {
    objectKey: string;
    partNumber: number;
    size: number;
}

interface TrajectoryIngestPayload {
    trajectoryId: string;
    teamId: string;
    stagedObjects: TrajectoryIngestStagedObject[];
}

interface TrajectoryIngestFrame extends ParsedFrameMetadata {
    size: number;
    objectKey: string;
}

interface TrajectoryIngestResult {
    trajectoryId: string;
    frames: TrajectoryIngestFrame[];
    stats: { totalFiles: number; totalSize: number };
}

const toIngestFrame = (
    metadata: ParsedFrameMetadata,
    size: number,
    objectKey: string
): TrajectoryIngestFrame => ({
    ...metadata,
    size,
    objectKey
});

@CommandGroup('trajectory')
export class TrajectoryIngestCommand {
    constructor(
        private readonly config: DaemonConfig,
        private readonly minioService: LocalClusterObjectStoreGateway,
        private readonly queueService: QueueService,
        private readonly stateStore: DaemonStateStore
    ) {}

    @Command('ingest')
    async ingest(payload: TrajectoryIngestPayload): Promise<TrajectoryIngestResult> {
        const { trajectoryId, teamId, stagedObjects } = payload;

        if (!trajectoryId) {
            throw new Error('trajectory.ingest requires trajectoryId');
        }
        if (!stagedObjects || stagedObjects.length === 0) {
            throw new Error(`trajectory.ingest requires at least one staged object (trajectoryId=${trajectoryId})`);
        }

        logger.info(
            `@trajectory-ingest: starting metadata parse for trajectoryId=${trajectoryId}, files=${stagedObjects.length}`
        );

        await mapLimited(
            stagedObjects,
            INGEST_FRAME_CONCURRENCY,
            (staged) => this.materializeStagedObject(staged)
        );

        const parsedFrames = await withNativeProcessingTempDir(
            'trajectory-ingest',
            async (tempDirectory) => {
                const frameGroups = await mapLimited(
                    stagedObjects,
                    INGEST_FRAME_CONCURRENCY,
                    (staged, index) => this.parseStagedObject(staged, index, trajectoryId, tempDirectory)
                );
                return frameGroups.flat();
            }
        );
        const frames = this.deduplicateFrames(parsedFrames, trajectoryId);

        if (frames.length === 0) {
            throw new Error(`No valid trajectory frames found in upload (trajectoryId=${trajectoryId})`);
        }

        const sessionPrefix = `trajectory-frame-session:${trajectoryId}`;
        const framesForParquet = frames.map((f) => ({
            timestep: f.timestep,
            objectKey: toTrajectoryFrameDumpObjectKey(trajectoryId, f.timestep)
        }));

        await this.stateStore.setValueWithTtl(`${sessionPrefix}:remaining`, frames.length.toString(), SESSION_TTL_SECONDS);
        await this.stateStore.setValueWithTtl(`${sessionPrefix}:frames`, JSON.stringify(framesForParquet), SESSION_TTL_SECONDS);

        await this.enqueueFrameProcessingJobs(trajectoryId, teamId, this.config.teamClusterId, frames);

        const totalSize = frames.reduce((sum, frame) => sum + frame.size, 0);

        logger.info(
            `@trajectory-ingest: metadata parsed and jobs enqueued for trajectoryId=${trajectoryId}, frames=${frames.length}, totalSize=${totalSize}`
        );

        return {
            trajectoryId,
            frames,
            stats: {
                totalFiles: frames.length,
                totalSize
            }
        };
    }

    /**
     * Verifies the client actually delivered every staged byte and concatenates the
     * parts. An incomplete or absent upload is the caller's problem, not ours, so it
     * has to surface as 422 rather than a daemon-side internal error.
     */
    private async materializeStagedObject(staged: TrajectoryIngestStagedObject): Promise<void> {
        const parts = (staged.parts ?? []).slice().sort((left, right) => left.partNumber - right.partNumber);

        const statUploaded = async (objectKey: string, label: string): Promise<number> => {
            try {
                return (await this.minioService.statObject(INGEST_BUCKET, objectKey)).size;
            } catch {
                throw ApplicationError.unprocessableEntity(
                    ErrorCodes.TRAJECTORY_UPLOAD_INCOMPLETE,
                    `${label} was never uploaded`
                );
            }
        };

        const rejectSizeMismatch = (label: string, expected: number, actual: number): never => {
            throw ApplicationError.unprocessableEntity(
                ErrorCodes.TRAJECTORY_UPLOAD_SIZE_MISMATCH,
                `${label} is ${actual} bytes but ${expected} bytes were declared`
            );
        };

        if (parts.length === 0) {
            const size = await statUploaded(staged.objectKey, staged.originalName);
            if (size !== staged.size) {
                rejectSizeMismatch(staged.originalName, staged.size, size);
            }
            return;
        }

        const partSizes = await Promise.all(parts.map(async (part) => {
            const label = `${staged.originalName} part ${part.partNumber}`;
            const size = await statUploaded(part.objectKey, label);
            if (size !== part.size) {
                rejectSizeMismatch(label, part.size, size);
            }
            return size;
        }));

        const totalSize = partSizes.reduce((sum, size) => sum + size, 0);
        if (totalSize !== staged.size) {
            rejectSizeMismatch(staged.originalName, staged.size, totalSize);
        }

        if (parts.length > 1 || parts[0]?.objectKey !== staged.objectKey) {
            await this.minioService.composeObject({
                bucket: INGEST_BUCKET,
                objectKey: staged.objectKey,
                sourceObjectKeys: parts.map((part) => part.objectKey)
            });
        }

        await Promise.all(parts
            .filter((part) => part.objectKey !== staged.objectKey)
            .map((part) => this.minioService.removeObject(INGEST_BUCKET, part.objectKey).catch((error) => {
                logger.debug(`@trajectory-ingest: upload part cleanup failed ${part.objectKey}: ${String(error)}`);
            })));
    }

    private async parseFrameMetadata(
        staged: TrajectoryIngestStagedObject,
        index: number,
        tempDirectory: string
    ): Promise<TrajectoryIngestFrame> {
        const safeOriginalName = path.basename(staged.originalName || 'trajectory-frame.dump');
        const localMetadataPath = path.join(tempDirectory, `frame-${index}-${safeOriginalName}`);
        const metadataReadLength = staged.size > 0
            ? Math.min(staged.size, METADATA_READ_BYTES)
            : METADATA_READ_BYTES;

        const stream = await this.minioService.getObjectRangeStream(
            INGEST_BUCKET,
            staged.objectKey,
            0,
            metadataReadLength
        );
        await pipeline(stream, createWriteStream(localMetadataPath));

        return toIngestFrame(await parseTrajectoryMetadata(localMetadataPath), staged.size, staged.objectKey);
    }

    private async parseStagedObject(
        staged: TrajectoryIngestStagedObject,
        index: number,
        trajectoryId: string,
        tempDirectory: string
    ): Promise<TrajectoryIngestFrame[]> {
        if (staged.originalName.toLowerCase().endsWith('.zip') || staged.objectKey.toLowerCase().endsWith('.zip')) {
            return this.expandZipAndParseFrames(staged, index, trajectoryId, tempDirectory);
        }

        try {
            return [await this.parseFrameMetadata(staged, index, tempDirectory)];
        } catch (error) {
            logger.warn(
                {
                    file: staged.originalName,
                    err: errorMessage(error)
                },
                '@trajectory-ingest: skipping unparseable staged file'
            );
            await this.removeIgnoredStagedObject(staged.objectKey);
            return [];
        }
    }

    private async expandZipAndParseFrames(
        staged: TrajectoryIngestStagedObject,
        archiveIndex: number,
        trajectoryId: string,
        tempDirectory: string
    ): Promise<TrajectoryIngestFrame[]> {
        const safeArchiveName = path.basename(staged.originalName || `archive-${archiveIndex}.zip`);
        const archivePath = path.join(tempDirectory, `archive-${archiveIndex}-${safeArchiveName}`);
        const extractRoot = path.join(tempDirectory, `archive-${archiveIndex}-frames`);
        const resolvedExtractRoot = path.resolve(extractRoot);

        await fs.mkdir(extractRoot, { recursive: true });

        const archiveStream = await this.minioService.getObjectStream(INGEST_BUCKET, staged.objectKey);
        await pipeline(archiveStream, createWriteStream(archivePath));

        const directory = await unzipper.Open.file(archivePath);
        const frames: TrajectoryIngestFrame[] = [];

        for (let entryIndex = 0; entryIndex < directory.files.length; entryIndex += 1) {
            const entry = directory.files[entryIndex];
            const basename = path.basename(entry.path);
            const isJunkEntry = basename.startsWith('.') ||
                ZIP_ENTRY_JUNK_BASENAMES.has(basename) ||
                entry.path.split('/').some((part) => ZIP_ENTRY_JUNK_BASENAMES.has(part));

            if (entry.type === 'Directory' || isJunkEntry) {
                continue;
            }

            const outputPath = path.join(extractRoot, entry.path);
            const resolvedOutputPath = path.resolve(outputPath);
            if (!resolvedOutputPath.startsWith(resolvedExtractRoot + path.sep) && resolvedOutputPath !== resolvedExtractRoot) {
                logger.warn(
                    {
                        entry: entry.path,
                        trajectoryId
                    },
                    '@trajectory-ingest: skipping ZIP entry with path traversal'
                );
                continue;
            }

            await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
            await pipeline(entry.stream(), createWriteStream(resolvedOutputPath));

            const stat = await fs.stat(resolvedOutputPath);
            if (stat.size === 0) {
                continue;
            }

            const metadata = await parseTrajectoryMetadata(resolvedOutputPath).catch((error) => {
                logger.warn(
                    {
                        entry: entry.path,
                        err: errorMessage(error)
                    },
                    '@trajectory-ingest: skipping unparseable ZIP entry'
                );
                return null;
            });
            if (!metadata) {
                continue;
            }

            const expandedObjectKey = `trajectory-staging/${trajectoryId}/expanded-${archiveIndex}-${entryIndex}-${basename}`;
            await this.minioService.putObjectStream({
                bucket: INGEST_BUCKET,
                objectKey: expandedObjectKey,
                stream: createReadStream(resolvedOutputPath),
                size: stat.size
            });

            frames.push(toIngestFrame(metadata, stat.size, expandedObjectKey));
        }

        if (frames.length === 0) {
            await this.removeIgnoredStagedObject(staged.objectKey);
            return [];
        }

        await this.minioService.removeObject(INGEST_BUCKET, staged.objectKey).catch((error) => {
            logger.debug(`@trajectory-ingest: archive staging cleanup failed ${staged.objectKey}: ${String(error)}`);
        });

        logger.info(
            `@trajectory-ingest: expanded ZIP trajectoryId=${trajectoryId}, archive=${staged.originalName}, frames=${frames.length}`
        );

        return frames;
    }

    private async removeIgnoredStagedObject(objectKey: string): Promise<void> {
        await this.minioService.removeObject(INGEST_BUCKET, objectKey).catch(() => undefined);
    }

    private async enqueueFrameProcessingJobs(
        trajectoryId: string,
        teamId: string,
        ownerClusterId: string,
        frames: TrajectoryIngestFrame[]
    ): Promise<void> {
        const timestamp = new Date().toISOString();
        const jobsToEnqueue: FrameProcessingQueueJobPayload[] = frames.map((frame) => ({
            jobId: `trajectory-glb:${trajectoryId}:${frame.timestep}`,
            teamId,
            trajectoryId,
            timestep: frame.timestep,
            stagingObjectKey: frame.objectKey,
            ownerClusterId,
            status: 'queued',
            queueType: TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME,
            metadata: {
                trajectoryId,
                timestep: frame.timestep
            },
            createdAt: timestamp,
            updatedAt: timestamp
        }));

        try {
            await this.queueService.enqueueBulk(TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME, jobsToEnqueue, {
                attempts: DEFAULT_FRAME_JOB_ATTEMPTS,
                backoff: {
                    type: 'exponential',
                    delay: DEFAULT_FRAME_JOB_BACKOFF_MS
                }
            });
        } catch (error) {
            logger.error(
                `@trajectory-ingest: frame processing enqueue failed for trajectoryId=${trajectoryId}: ${String(error)}`
            );
            throw error;
        }
    }

    private deduplicateFrames(frames: TrajectoryIngestFrame[], trajectoryId: string): TrajectoryIngestFrame[] {
        const byTimestep = new Map<number, TrajectoryIngestFrame>();

        for (const frame of frames) {
            if (byTimestep.has(frame.timestep)) {
                logger.warn(
                    `@trajectory-ingest: dropping duplicate frame trajectoryId=${trajectoryId} timestep=${frame.timestep}`
                );
                continue;
            }
            byTimestep.set(frame.timestep, frame);
        }

        return [...byTimestep.values()].sort((left, right) => left.timestep - right.timestep);
    }
}

export const getTrajectoryIngestCommand = commandGroupFactory(TrajectoryIngestCommand, () => new TrajectoryIngestCommand(getConfig(), getMinioService(), getQueueService(), getDaemonStateStore()));
