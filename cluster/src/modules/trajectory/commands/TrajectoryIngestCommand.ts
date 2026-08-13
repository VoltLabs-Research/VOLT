import { errorMessage } from '@shared/application/utilities/error-message';
import { ErrorCodes } from '@core/constants/error-codes';
import { getConfig } from '@core/config/daemon';
import { getFilesystemObjectStore } from '@shared/infrastructure/storage/FilesystemObjectStore';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import type { File as ZipEntry } from 'unzipper';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { logger } from '@shared/infrastructure/logger';
import type { DaemonConfig } from '@core/config/daemon';
import type { LocalClusterObjectStoreGateway } from '@shared/contracts/types/cluster-object-store';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import { TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME, toTrajectoryFrameJobKey } from '@core/constants/queue-names';
import type { FrameProcessingQueueJobPayload } from '@shared/contracts/types/queue-trajectory';
import { scanTrajectoryFrames, type ParsedFrameMetadata } from '@modules/trajectory/services/parsing/TrajectoryParserFactory';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import { mapLimited } from '@shared/application/utilities/map-limited';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const INGEST_FRAME_CONCURRENCY = readPositiveIntegerEnv('TRAJECTORY_INGEST_CONCURRENCY') ?? 8;
const DEFAULT_FRAME_JOB_ATTEMPTS = readPositiveIntegerEnv('TRAJECTORY_FRAME_JOB_ATTEMPTS') ?? 3;
const DEFAULT_FRAME_JOB_BACKOFF_MS = readPositiveIntegerEnv('TRAJECTORY_FRAME_JOB_BACKOFF_MS') ?? 2000;
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
        private readonly objectStore: LocalClusterObjectStoreGateway,
        private readonly queueService: QueueService
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

        const readyObjects = await this.materializeStagedObjects(stagedObjects);

        const parsedFrames = await withNativeProcessingTempDir(
            'trajectory-ingest',
            async (tempDirectory) => {
                const frameGroups = await mapLimited(
                    readyObjects,
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

        await this.enqueueFrameProcessingJobs(trajectoryId, teamId, this.config.teamClusterId, frames);

        const totalSize = frames.reduce((sum, frame) => sum + frame.size, 0);

        logger.info(
            `@trajectory-ingest: headers read and jobs enqueued for trajectoryId=${trajectoryId}, ` +
            `files=${readyObjects.length}, frames=${frames.length}, totalSize=${totalSize}`
        );

        return {
            trajectoryId,
            frames,
            stats: {
                // Files as uploaded, which is no longer the same as the frame count: one
                // multi-frame dump is a single file holding many frames.
                totalFiles: readyObjects.length,
                totalSize
            }
        };
    }

    /**
     * Stages every uploaded object and keeps the ones that landed intact. A single
     * missing or truncated file must not discard the rest of the upload, but if none
     * of them can be staged the original failure is surfaced instead of the much less
     * helpful "no valid trajectory frames".
     */
    private async materializeStagedObjects(
        stagedObjects: TrajectoryIngestStagedObject[]
    ): Promise<TrajectoryIngestStagedObject[]> {
        const outcomes = await mapLimited(
            stagedObjects,
            INGEST_FRAME_CONCURRENCY,
            async (staged) => {
                try {
                    await this.materializeStagedObject(staged);
                    return {
                        staged,
                        error: null as unknown
                    };
                } catch (error) {
                    logger.warn(
                        {
                            file: staged.originalName,
                            err: errorMessage(error)
                        },
                        '@trajectory-ingest: skipping staged file that could not be materialized'
                    );
                    return {
                        staged,
                        error
                    };
                }
            }
        );

        const ready = outcomes.filter((outcome) => outcome.error === null);
        if (ready.length === 0) {
            throw outcomes[0].error;
        }

        return ready.map((outcome) => outcome.staged);
    }

    private async materializeStagedObject(staged: TrajectoryIngestStagedObject): Promise<void> {
        const parts = (staged.parts ?? []).slice().sort((left, right) => left.partNumber - right.partNumber);

        const statUploaded = async (objectKey: string, label: string): Promise<number> => {
            try {
                return (await this.objectStore.statObject(INGEST_BUCKET, objectKey)).size;
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
            await this.objectStore.composeObject({
                bucket: INGEST_BUCKET,
                objectKey: staged.objectKey,
                sourceObjectKeys: parts.map((part) => part.objectKey)
            });
        }

        await Promise.all(parts
            .filter((part) => part.objectKey !== staged.objectKey)
            .map((part) => this.objectStore.removeObject(INGEST_BUCKET, part.objectKey).catch((error) => {
                logger.debug(`@trajectory-ingest: upload part cleanup failed ${part.objectKey}: ${String(error)}`);
            })));
    }

    /**
     * Turns one local file into one staged object per frame it contains.
     *
     * A single-frame file keeps the staged object it arrived in — the common case, where
     * copying it would double the upload's I/O for no gain. A multi-frame file is cut
     * along the byte ranges the scan reports, which reproduces each frame byte for byte
     * without reserializing anything, and leaves every timestep with a dump file of its
     * own. That last part is the contract the analysis plugins are written against: they
     * are handed one dump per timestep.
     */
    private async promoteFramesToStagedObjects(
        localPath: string,
        expandedKeyPrefix: string,
        reusable: { objectKey: string; size: number } | null
    ): Promise<TrajectoryIngestFrame[]> {
        const frames = scanTrajectoryFrames(localPath);

        if (frames.length === 1 && reusable) {
            return [toIngestFrame(frames[0].metadata, reusable.size, reusable.objectKey)];
        }

        const promoted: TrajectoryIngestFrame[] = [];

        for (const frame of frames) {
            const framePath = `${localPath}.frame-${frame.index}`;
            const objectKey = `${expandedKeyPrefix}-${frame.metadata.timestep}.dump`;

            await pipeline(
                createReadStream(localPath, {
                    start: frame.byteOffset,
                    end: frame.byteOffset + frame.byteLength - 1
                }),
                createWriteStream(framePath)
            );

            await this.objectStore.putObjectStream({
                bucket: INGEST_BUCKET,
                objectKey,
                stream: createReadStream(framePath),
                size: frame.byteLength
            });

            await fs.unlink(framePath).catch(() => {});
            promoted.push(toIngestFrame(frame.metadata, frame.byteLength, objectKey));
        }

        return promoted;
    }

    private async splitStagedObjectIntoFrames(
        staged: TrajectoryIngestStagedObject,
        index: number,
        trajectoryId: string
    ): Promise<TrajectoryIngestFrame[]> {
        // Read in place: the staged object is already a file on this host, and the reader
        // memory-maps it. Streaming a copy somewhere else first would mean copying a
        // multi-gigabyte trajectory to look at its frame boundaries.
        const localPath = this.objectStore.resolveLocalPath(INGEST_BUCKET, staged.objectKey);

        const frames = await this.promoteFramesToStagedObjects(
            localPath,
            `trajectory-staging/${trajectoryId}/expanded-${index}`,
            {
                objectKey: staged.objectKey,
                size: staged.size
            }
        );

        // A file that turned into several frames has been superseded by its parts.
        if (frames.length > 0 && frames[0].objectKey !== staged.objectKey) {
            await this.removeIgnoredStagedObject(staged.objectKey);
        }

        return frames;
    }

    private async parseStagedObject(
        staged: TrajectoryIngestStagedObject,
        index: number,
        trajectoryId: string,
        tempDirectory: string
    ): Promise<TrajectoryIngestFrame[]> {
        const isArchive = staged.originalName.toLowerCase().endsWith('.zip') ||
            staged.objectKey.toLowerCase().endsWith('.zip');

        try {
            return isArchive
                ? await this.expandZipAndParseFrames(staged, index, trajectoryId, tempDirectory)
                : await this.splitStagedObjectIntoFrames(staged, index, trajectoryId);
        } catch (error) {
            logger.warn(
                {
                    file: staged.originalName,
                    err: errorMessage(error)
                },
                isArchive
                    ? '@trajectory-ingest: skipping unreadable ZIP archive'
                    : '@trajectory-ingest: skipping unparseable staged file'
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

        const archiveStream = await this.objectStore.getObjectStream(INGEST_BUCKET, staged.objectKey);
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

            const entryFrames = await this.extractZipEntryFrames(
                entry,
                resolvedOutputPath,
                `trajectory-staging/${trajectoryId}/expanded-${archiveIndex}-${entryIndex}-${basename}`
            ).catch((error) => {
                logger.warn(
                    {
                        entry: entry.path,
                        err: errorMessage(error)
                    },
                    '@trajectory-ingest: skipping unreadable ZIP entry'
                );
                return [];
            });

            frames.push(...entryFrames);
        }

        if (frames.length === 0) {
            await this.removeIgnoredStagedObject(staged.objectKey);
            return [];
        }

        await this.objectStore.removeObject(INGEST_BUCKET, staged.objectKey).catch((error) => {
            logger.debug(`@trajectory-ingest: archive staging cleanup failed ${staged.objectKey}: ${String(error)}`);
        });

        logger.info(
            `@trajectory-ingest: expanded ZIP trajectoryId=${trajectoryId}, archive=${staged.originalName}, frames=${frames.length}`
        );

        return frames;
    }

    /**
     * Extracts a single archive entry and promotes its frames to staged objects.
     *
     * Returns an empty list for entries that hold no data; anything unreadable throws so
     * the caller can drop that entry and keep the rest of the archive. An entry may itself
     * be multi-frame — a ZIP of multi-frame dumps is a perfectly ordinary upload.
     */
    private async extractZipEntryFrames(
        entry: ZipEntry,
        outputPath: string,
        expandedKeyPrefix: string
    ): Promise<TrajectoryIngestFrame[]> {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await pipeline(entry.stream(), createWriteStream(outputPath));

        const stat = await fs.stat(outputPath);
        if (stat.size === 0) {
            return [];
        }

        // No reusable staged object here: the entry only ever existed inside the archive,
        // so every frame it yields has to be promoted on its own.
        return this.promoteFramesToStagedObjects(outputPath, expandedKeyPrefix, null);
    }

    private async removeIgnoredStagedObject(objectKey: string): Promise<void> {
        await this.objectStore.removeObject(INGEST_BUCKET, objectKey).catch(() => undefined);
    }

    private async enqueueFrameProcessingJobs(
        trajectoryId: string,
        teamId: string,
        ownerClusterId: string,
        frames: TrajectoryIngestFrame[]
    ): Promise<void> {
        const timestamp = new Date().toISOString();
        const jobsToEnqueue: FrameProcessingQueueJobPayload[] = frames.map((frame) => ({
            jobId: toTrajectoryFrameJobKey(trajectoryId, frame.timestep),
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

export const getTrajectoryIngestCommand = commandGroupFactory(TrajectoryIngestCommand, () => new TrajectoryIngestCommand(getConfig(), getFilesystemObjectStore(), getQueueService()));
