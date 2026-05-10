import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import { Command, CommandGroup } from '@/core/commands/decorators';
import { logger } from '@/core/logger';
import type { DaemonConfig } from '@/core/config';
import type { LocalClusterObjectStoreGateway } from '@/core/storage/contracts/cluster-object-store';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import type { QueueService } from '@/core/queues/application/QueueService';
import type { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import { TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { FrameProcessingQueueJobPayload } from '@/contracts';
import { parseTrajectoryMetadata, type ParsedSimulationCell } from '@/modules/trajectory/application/parsing/TrajectoryParserFactory';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { mapLimited } from '@/support/concurrency/map-limited';
import { readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';

const INGEST_FRAME_CONCURRENCY = readPositiveIntegerEnv('TRAJECTORY_INGEST_CONCURRENCY') ?? 8;
const METADATA_READ_BYTES = readPositiveIntegerEnv('TRAJECTORY_METADATA_READ_BYTES') ?? 4 * 1024 * 1024;
const DEFAULT_FRAME_JOB_ATTEMPTS = readPositiveIntegerEnv('TRAJECTORY_FRAME_JOB_ATTEMPTS') ?? 3;
const DEFAULT_FRAME_JOB_BACKOFF_MS = readPositiveIntegerEnv('TRAJECTORY_FRAME_JOB_BACKOFF_MS') ?? 2000;
const SESSION_TTL_SECONDS = 86400;
const ZIP_ENTRY_JUNK_BASENAMES = new Set(['__MACOSX', '.DS_Store', 'Thumbs.db']);

interface TrajectoryIngestStagedObject {
    objectKey: string;
    originalName: string;
    size: number;
}

interface TrajectoryIngestPayload {
    trajectoryId: string;
    teamId: string;
    stagedObjects: TrajectoryIngestStagedObject[];
}

interface TrajectoryIngestFrame {
    timestep: number;
    natoms: number;
    headers: string[];
    simulationCell: ParsedSimulationCell | null;
    size: number;
    objectKey: string;
}

interface TrajectoryIngestResult {
    trajectoryId: string;
    frames: TrajectoryIngestFrame[];
    stats: { totalFiles: number; totalSize: number };
}

@CommandGroup('trajectory')
export class TrajectoryIngestCommand {
    constructor(
        private readonly config: DaemonConfig,
        private readonly minioService: LocalClusterObjectStoreGateway,
        private readonly queueService: QueueService,
        private readonly redisConnection: RedisConnection
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

        const ownerClusterId = this.config.teamClusterId;
        const bucket = ObjectBucketName.Dumps;

        // Phase 1: Download and parse metadata only. ZIP uploads are expanded into normal staged frames.
        const parsedFrames = await withNativeProcessingTempDir(
            'trajectory-ingest',
            async (tempDirectory) => {
                const frameGroups = await mapLimited(
                    stagedObjects,
                    INGEST_FRAME_CONCURRENCY,
                    async (staged, index) => {
                        return this.parseStagedObject(staged, index, trajectoryId, bucket, tempDirectory);
                    }
                );
                return frameGroups.flat();
            }
        );
        const frames = this.deduplicateFrames(parsedFrames, trajectoryId);

        // Phase 2: Initialize session counter and enqueue jobs
        const sessionPrefix = `trajectory-frame-session:${trajectoryId}`;
        const framesForParquet = frames.map((f) => ({
            timestep: f.timestep,
            objectKey: `trajectory-${trajectoryId}/timestep-${f.timestep}.dump.zst`
        }));

        await this.redisConnection.setValueWithTtl(`${sessionPrefix}:remaining`, frames.length.toString(), SESSION_TTL_SECONDS);
        await this.redisConnection.setValueWithTtl(`${sessionPrefix}:frames`, JSON.stringify(framesForParquet), SESSION_TTL_SECONDS);

        await this.enqueueFrameProcessingJobs(trajectoryId, teamId, ownerClusterId, frames);

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

    private async parseFrameMetadata(
        staged: TrajectoryIngestStagedObject,
        index: number,
        bucket: string,
        tempDirectory: string
    ): Promise<TrajectoryIngestFrame> {
        const safeOriginalName = path.basename(staged.originalName || 'trajectory-frame.dump');
        const localMetadataPath = path.join(tempDirectory, `frame-${index}-${safeOriginalName}`);
        const metadataReadLength = staged.size > 0
            ? Math.min(staged.size, METADATA_READ_BYTES)
            : METADATA_READ_BYTES;

        // Only the header is needed here. The queued frame job consumes the full staged object later.
        const stream = await this.minioService.getObjectRangeStream(
            bucket,
            staged.objectKey,
            0,
            metadataReadLength
        );
        await pipeline(stream, createWriteStream(localMetadataPath));

        // Parse metadata only (reads first ~200 lines)
        const metadata = await parseTrajectoryMetadata(localMetadataPath);

        return {
            timestep: metadata.timestep,
            natoms: metadata.natoms,
            headers: metadata.headers,
            simulationCell: metadata.simulationCell ?? null,
            size: staged.size,
            objectKey: staged.objectKey
        };
    }

    private async parseStagedObject(
        staged: TrajectoryIngestStagedObject,
        index: number,
        trajectoryId: string,
        bucket: string,
        tempDirectory: string
    ): Promise<TrajectoryIngestFrame[]> {
        if (this.isZipUpload(staged)) {
            return this.expandZipAndParseFrames(staged, index, trajectoryId, bucket, tempDirectory);
        }

        return [await this.parseFrameMetadata(staged, index, bucket, tempDirectory)];
    }

    private async expandZipAndParseFrames(
        staged: TrajectoryIngestStagedObject,
        archiveIndex: number,
        trajectoryId: string,
        bucket: string,
        tempDirectory: string
    ): Promise<TrajectoryIngestFrame[]> {
        const safeArchiveName = path.basename(staged.originalName || `archive-${archiveIndex}.zip`);
        const archivePath = path.join(tempDirectory, `archive-${archiveIndex}-${safeArchiveName}`);
        const extractRoot = path.join(tempDirectory, `archive-${archiveIndex}-frames`);
        const resolvedExtractRoot = path.resolve(extractRoot);

        await fs.mkdir(extractRoot, { recursive: true });

        const archiveStream = await this.minioService.getObjectStream(bucket, staged.objectKey);
        await pipeline(archiveStream, createWriteStream(archivePath));

        const directory = await unzipper.Open.file(archivePath);
        const frames: TrajectoryIngestFrame[] = [];

        for (let entryIndex = 0; entryIndex < directory.files.length; entryIndex += 1) {
            const entry = directory.files[entryIndex];
            const basename = path.basename(entry.path);

            if (entry.type === 'Directory' || this.isJunkZipEntry(entry.path, basename)) {
                continue;
            }

            const outputPath = path.join(extractRoot, entry.path);
            const resolvedOutputPath = path.resolve(outputPath);
            if (!resolvedOutputPath.startsWith(resolvedExtractRoot + path.sep) && resolvedOutputPath !== resolvedExtractRoot) {
                logger.warn(
                    { entry: entry.path, trajectoryId },
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

            let metadata;
            try {
                metadata = await parseTrajectoryMetadata(resolvedOutputPath);
            } catch (error) {
                if (this.isUnsupportedTrajectoryFormatError(error)) {
                    logger.debug(
                        `@trajectory-ingest: skipping unsupported ZIP entry trajectoryId=${trajectoryId} entry=${entry.path}`
                    );
                    continue;
                }
                throw error;
            }

            const expandedObjectKey = `trajectory-staging/${trajectoryId}/expanded-${archiveIndex}-${entryIndex}-${basename}`;
            await this.minioService.putObjectStream({
                bucket,
                objectKey: expandedObjectKey,
                stream: createReadStream(resolvedOutputPath),
                size: stat.size
            });

            frames.push({
                timestep: metadata.timestep,
                natoms: metadata.natoms,
                headers: metadata.headers,
                simulationCell: metadata.simulationCell ?? null,
                size: stat.size,
                objectKey: expandedObjectKey
            });
        }

        if (frames.length === 0) {
            throw new Error(`Unsupported trajectory archive: no LAMMPS dump/data frames found in ${staged.originalName}`);
        }

        await this.minioService.removeObject(bucket, staged.objectKey).catch((error) => {
            logger.debug(`@trajectory-ingest: archive staging cleanup failed ${staged.objectKey}: ${String(error)}`);
        });

        logger.info(
            `@trajectory-ingest: expanded ZIP trajectoryId=${trajectoryId}, archive=${staged.originalName}, frames=${frames.length}`
        );

        return frames;
    }

    private isZipUpload(staged: TrajectoryIngestStagedObject): boolean {
        return staged.originalName.toLowerCase().endsWith('.zip') || staged.objectKey.toLowerCase().endsWith('.zip');
    }

    private isJunkZipEntry(entryPath: string, basename: string): boolean {
        return basename.startsWith('.') ||
            ZIP_ENTRY_JUNK_BASENAMES.has(basename) ||
            entryPath.split('/').some((part) => ZIP_ENTRY_JUNK_BASENAMES.has(part));
    }

    private isUnsupportedTrajectoryFormatError(error: unknown): boolean {
        return error instanceof Error && error.message === 'Unsupported trajectory format';
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
            queueType: TRAJECTORY_GLB_QUEUE_NAME,
            metadata: {
                trajectoryId,
                timestep: frame.timestep
            },
            createdAt: timestamp,
            updatedAt: timestamp
        }));

        if (jobsToEnqueue.length > 0) {
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
