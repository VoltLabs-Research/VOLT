import { getTrajectoryBackgroundProcessorConcurrency } from '@core/config/trajectory';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import Trajectory, { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/trajectory/TrajectoryParserFactory';
import CloudUploadQueueService from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadQueueService';
import CompressionQueueService, { CompressionJobData } from '@modules/trajectory/infrastructure/services/trajectory/CompressionQueueService';
import { normalizeTrajectoryWorkerFailure } from '@modules/trajectory/utilities/trajectory/trajectory-worker-failure';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';

import IORedis from 'ioredis';
import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { inject } from 'tsyringe';

import type { ErrorCode } from '@core/constants/error-codes';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import DaemonAnalysisCompletionService from '@modules/cluster/infrastructure/services/DaemonAnalysisCompletionService';
import type { ITrajectoryBackgroundProcessor, ProcessorContext, TrajectoryUploadFile } from '@modules/trajectory/domain/port/trajectory/ITrajectoryBackgroundProcessor';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import TrajectoryUploadStagingService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryUploadStagingService';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { ExtractedFile } from '@shared/domain/port/IFileExtractorService';
import FileExtractorService from '@shared/infrastructure/services/FileExtractorService';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import TempFileService from '@shared/infrastructure/services/TempFileService';

type ParsedFrame = {
    timestep: number;
    natoms: number;
    simulationCell: string;
    size: number;
    cachePath: string;
    [key: string]: unknown;
};

interface GlbPreprocessingEnqueueResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
};

interface VtrIngestResult {
    objectKey: string;
    frameCount: number;
    size: number;
    bucket: string;
};

const GLB_SESSION_TTL_SECONDS = 86400;
const GLB_ENQUEUE_BATCH_SIZE = 500;
const VTR_INGEST_BATCH_SIZE = 200;

interface GlbFrameDescriptor {
    timestep: number;
    objectKey: string;
    ownerClusterId: string;
};

interface RequeueGlbPreprocessingInput {
    trajectoryId: string;
    teamId: string;
    timesteps?: number[];
}

const chunkItems = <T>(items: T[], chunkSize: number): T[][] => {
    if (items.length === 0) {
        return [];
    }

    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }

    return chunks;
};

@Singleton()
export default class TrajectoryBackgroundProcessor implements ITrajectoryBackgroundProcessor {
    private readonly concurrency = getTrajectoryBackgroundProcessorConcurrency();
    private drainCallbackRegistered = false;
    private compressionDrainCallbackRegistered = false;

    constructor(
        
        private readonly tempFileService: TempFileService,

        
        private readonly trajectoryRepo: TrajectoryRepository,

        
        private readonly trajectoryFrameRepo: TrajectoryFrameRepository,

        
        private readonly simulationCellRepo: SimulationCellRepository,

        
        private readonly cloudUploadQueueService: CloudUploadQueueService,

        
        private readonly compressionQueueService: CompressionQueueService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        
        private readonly extractor: FileExtractorService,

        
        private readonly uploadStagingService: TrajectoryUploadStagingService,

        
        private readonly dumpStorage: TrajectoryDumpStorageService,

        
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        
        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService
    ){}

    async requeueGlbPreprocessing(input: RequeueGlbPreprocessingInput): Promise<string[]> {
        const trajectory = await this.trajectoryRepo.findById(input.trajectoryId);
        if (!trajectory) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                `Trajectory ${input.trajectoryId} not found`
            );
        }

        const persistedFrames = await this.trajectoryFrameRepo.getFrames(input.trajectoryId);
        if (persistedFrames.length === 0) {
            logger.warn(`@trajectory-background-processor: requeue skipped — no persisted frames trajectoryId=${input.trajectoryId}`);
            return [];
        }

        const requestedTimesteps = input.timesteps && input.timesteps.length > 0
            ? new Set(input.timesteps)
            : null;

        const frames = persistedFrames
            .filter((frame) => requestedTimesteps?.has(frame.timestep) ?? true)
            .map((frame) => ({
                timestep: frame.timestep,
                natoms: frame.natoms,
                simulationCell: frame.simulationCell
            }));

        if (frames.length === 0) {
            logger.warn(`@trajectory-background-processor: requeue skipped — no matching persisted frames trajectoryId=${input.trajectoryId}`);
            return [];
        }

        await this.enqueueGlbPreprocessing(frames, trajectory, input.teamId);

        return frames.map((frame) => `trajectory-glb:${input.trajectoryId}:${frame.timestep}`);
    }

    private registerUploadDrainCallback(): void {
        if (this.drainCallbackRegistered) return;
        this.drainCallbackRegistered = true;

        this.cloudUploadQueueService.onSessionDrain(
            async (trajectoryId, teamId, _teamClusterId, _trajectoryName, failedCount, successfulTimesteps) => {
                const trajectory = await this.trajectoryRepo.findById(trajectoryId);
                if (!trajectory) {
                    logger.warn(`@trajectory-background-processor: drain callback — trajectory not found, skipping GLB enqueue trajectoryId=${trajectoryId}`);
                    return;
                }

                const persistedFrames = await this.trajectoryFrameRepo.getFrames(trajectoryId);
                const allFrames = persistedFrames.map((f) => ({
                    timestep: f.timestep,
                    natoms: f.natoms,
                    simulationCell: f.simulationCell
                })) as Array<{ timestep: number; [key: string]: unknown }>;

                // Filter frames to only include those whose uploads succeeded
                const successfulTimestepSet = new Set(successfulTimesteps);
                const frames = allFrames.filter((f) => successfulTimestepSet.has(f.timestep));

                if (failedCount > 0) {
                    logger.warn(`@trajectory-background-processor: upload failures detected, marking trajectory as failed trajectoryId=${trajectoryId} failedCount=${failedCount} totalFrames=${allFrames.length} successfulFrames=${frames.length}`);

                    await this.updateStatus(
                        trajectoryId,
                        trajectory.props.team,
                        TrajectoryStatus.Failed,
                        {
                            failureCode: ErrorCodes.WORKER_FAILURE,
                            failureDetails: 'One or more trajectory frame uploads failed before GLB preprocessing.'
                        }
                    );

                    return;
                }

                if (frames.length === 0) {
                    logger.warn(`@trajectory-background-processor: drain callback — no successfully uploaded frames, skipping GLB enqueue trajectoryId=${trajectoryId} failedCount=${failedCount}`);

                    await this.updateStatus(
                        trajectoryId,
                        trajectory.props.team,
                        TrajectoryStatus.Failed,
                        {
                            failureCode: ErrorCodes.WORKER_FAILURE,
                            failureDetails: 'No trajectory frames were uploaded successfully.'
                        }
                    );

                    return;
                }

                await this.runVtrIngest(frames, trajectory, teamId);
                await this.enqueueGlbPreprocessing(frames, trajectory, teamId);
            }
        );
    }

    /**
     * Triggers the daemon's .vtr ingest command with the full frame manifest.
     * The daemon downloads each .dump.zst (which only exists as a short-lived
     * raw archive), decompresses it, and writes the canonical .vtr back to
     * its MinIO instance. We block GLB preprocessing until the .vtr lands to
     * ensure downstream reads resolve against it.
     */
    private async runVtrIngest(
        frames: Array<{ timestep: number; [key: string]: unknown }>,
        trajectory: Trajectory,
        _teamId: string
    ): Promise<void> {
        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        if (!storageClusterId) {
            logger.warn(`@trajectory-background-processor: skipping vtr ingest — no storageClusterId trajectoryId=${trajectory._id}`);
            return;
        }

        const frameDescriptors = frames.map((frame) => ({
            timestep: Number(frame.timestep),
            objectKey: this.dumpStorage.getObjectName(trajectory._id, String(frame.timestep))
        }));

        if (frameDescriptors.length === 0) return;

        for (let offset = 0; offset < frameDescriptors.length; offset += VTR_INGEST_BATCH_SIZE) {
            const batch = frameDescriptors.slice(offset, offset + VTR_INGEST_BATCH_SIZE);
            await this.teamClusterDaemonClient.command<VtrIngestResult>(
                storageClusterId,
                ChannelCommands.TrajectoryVtrIngest,
                {
                    trajectoryId: trajectory._id,
                    ownerClusterId: storageClusterId,
                    frames: batch,
                    lossless: true
                },
                {
                    timeoutClass: 'long-running-control-plane'
                }
            );
        }

        logger.info(`@trajectory-background-processor: vtr ingest complete trajectoryId=${trajectory._id} frameCount=${frameDescriptors.length}`);
    }

    private registerCompressionDrainCallback(): void {
        if (this.compressionDrainCallbackRegistered) return;
        this.compressionDrainCallbackRegistered = true;

        this.compressionQueueService.onSessionDrain(
            async (trajectoryId, teamId, _teamClusterId, _trajectoryName, failedCount, successfulJobs) => {
                if (failedCount > 0 || successfulJobs.length === 0) {
                    await this.updateStatus(
                        trajectoryId,
                        teamId,
                        TrajectoryStatus.Failed,
                        {
                            failureCode: ErrorCodes.WORKER_FAILURE,
                            failureDetails: 'One or more trajectory frame compression jobs failed before upload.'
                        }
                    );
                    return;
                }

                await this.dispatchCloudUploadJobs(successfulJobs);
            }
        );
    }

    public async process(
        trajectoryId: string,
        files: TrajectoryUploadFile[],
        teamId: string
    ): Promise<void>{
        this.registerUploadDrainCallback();
        this.registerCompressionDrainCallback();

        const ctx = await this.createContext(trajectoryId);
        let failureCode: ErrorCode | undefined;
        let failureDetails: string | undefined;

        try{
            const trajectory = await this.loadTrajectory(trajectoryId);
            await this.updateStatus(
                trajectoryId,
                teamId,
                TrajectoryStatus.Processing
            );

            const stagedFiles = await this.uploadStagingService.stageUploads(trajectoryId, files);
            const extractedFiles = await this.extractor.extractFiles(stagedFiles, ctx.workingDir);
            const frames = await this.buildFrames(trajectoryId, teamId, extractedFiles);
            this.ensureValidFrames(frames);

            await this.persistTrajectory(trajectoryId, frames);
            await this.dispatchJobs(frames, trajectory, teamId);
            // GLB preprocessing is now triggered automatically when all upload jobs
            // complete, via the CloudUploadQueueService drain callback. This ensures
            // dumps are fully uploaded before the daemon starts GLB conversion.
        }catch(error){
            const failure = normalizeTrajectoryWorkerFailure(
                error,
                ErrorCodes.WORKER_FAILURE
            );

            failureCode = failure.code;
            failureDetails = failure.details;

            logger.error(
                error,
                `@trajectory-background-processor: processing failed for ${trajectoryId} with ${failureCode}`
            );
            logger.warn(`@trajectory-background-processor: marking trajectory as failed failureCode=${failureCode} trajectoryId=${trajectoryId}`);
            await this.updateStatus(
                trajectoryId,
                teamId,
                TrajectoryStatus.Failed,
                {
                    failureCode,
                    failureDetails
                }
            );
        }finally{
            await this.cleanup(ctx);
        }
    }

    private async createContext(trajectoryId: string): Promise<ProcessorContext>{
        const workingDir = this.tempFileService.getDirPath(`trajectory-uploads/${trajectoryId}`);
        const incomingDir = path.join(workingDir, 'incoming');

        await this.tempFileService.ensureDir(incomingDir);

        return {
            workingDir,
            incomingDir
        };
    }

    private async cleanup(ctx: ProcessorContext){
        await this.tempFileService.delete(ctx.workingDir, {
            recursive: true,
            force: true
        }).catch(() => {});
    }

    private async loadTrajectory(trajectoryId: string){
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        if(!trajectory){
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            );
        }

        return trajectory;
    }

    private ensureValidFrames(frames: ParsedFrame[]){
        if(frames.length === 0){
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES,
                'No valid trajectory files were found'
            );
        }
    }

    /**
     * Builds and sorts valid trajectory frames, deduplicated by timestep.
     *
     * Uploaded directories can legally contain the same dump twice (e.g. a
     * top-level `dump.ensayo.50000.config` and a nested `e/dump.ensayo.50000.config`).
     * Both resolve to the same timestep, which is the unit of work for every
     * downstream stage (cache path, object key, GLB jobId on the daemon). The
     * daemon's BullMQ deduplicates by jobId, so without this dedup the server
     * would initialize the GLB drain counter using the inflated frame count and
     * the decrement would never reach zero, leaving the trajectory in
     * `processing` forever. Keep the first parsed occurrence per timestep.
     */
    private async buildFrames(
        trajectoryId: string,
        teamId: string,
        files: ExtractedFile[]
    ): Promise<ParsedFrame[]>{
        const limit = pLimit(this.concurrency);
        const parsed = await Promise.all(files.map((file) => {
            return limit(() => this.parseFrame(trajectoryId, teamId, file));
        }));

        const byTimestep = new Map<number, ParsedFrame>();
        for (const frame of parsed) {
            if (!frame) continue;
            const timestep = frame.timestep as number;
            if (byTimestep.has(timestep)) {
                logger.warn(`@trajectory-background-processor: dropping duplicate frame trajectoryId=${trajectoryId} timestep=${timestep}`);
                continue;
            }
            byTimestep.set(timestep, frame);
        }

        return [...byTimestep.values()].sort((a, b) => (a.timestep as number) - (b.timestep as number));
    }

    private async parseFrame(
        trajectoryId: string,
        teamId: string,
        file: ExtractedFile
    ): Promise<ParsedFrame | null>{
        try{
            const metadata = await TrajectoryParserFactory.parseMetadata(file.path as string);
            if (!metadata) return null;

            const { simulationCell, ...frameMetadata } = metadata;

            const simulationCellId = await this.createSimulationCell(
                trajectoryId,
                teamId,
                frameMetadata.timestep,
                simulationCell
            );

            const cachePath = await this.cacheFrame(
                trajectoryId,
                frameMetadata.timestep,
                file.path as string
            );

            return {
                ...frameMetadata,
                size: file.size as number,
                simulationCell: simulationCellId ?? '',
                cachePath
            };
        }catch(error){
            logger.warn(`@trajectory-background-processor: skipping file ${file.originalname}: ${String(error)}`);
            return null;
        }
    }

    /**
     * Moves a frame file into the trajectory cache.
     *
     * Uses `fs.rename` which is an atomic metadata-only operation when source
     * and destination reside on the same filesystem (both live under the
     * tempFileService root).  This turns a ~219 MB copy (~200 ms) into a
     * sub-millisecond inode pointer swap.
     *
     * Falls back to `fs.copyFile` + `fs.unlink` for the rare cross-device case
     * (EXDEV), e.g. when tmpdir and cache are on different mount points.
     */
    private async cacheFrame(
        trajectoryId: string,
        timestep: number,
        sourcePath: string
    ): Promise<string>{
        const cachePath = path.join(
            this.tempFileService.rootPath,
            'trajectory-cache',
            trajectoryId,
            `${timestep}.dump`
        );

        await fs.mkdir(path.dirname(cachePath), { recursive: true });

        try {
            await fs.rename(sourcePath, cachePath);
        } catch (error: unknown) {
            if (error instanceof Error && 'code' in error && error.code === 'EXDEV') {
                await fs.copyFile(sourcePath, cachePath);
                await fs.unlink(sourcePath).catch(() => {});
            } else {
                throw error;
            }
        }

        return cachePath;
    }

    private async createSimulationCell(
        trajectoryId: string,
        teamId: string,
        timestep: number,
        data: Record<string, unknown> | null
    ): Promise<string | null>{
        if(!data) return null;
        try{
            const cell = await this.simulationCellRepo.create({
                ...data,
                team: teamId,
                trajectory: trajectoryId,
                timestep
            });
            return cell._id;
        }catch{
            logger.warn(`@trajectory-background-processor: simulation cell failed ${trajectoryId}:${timestep}`);
            return null;
        }
    }

    private async persistTrajectory(
        trajectoryId: string,
        frames: ParsedFrame[]
    ): Promise<void>{
        const totalSize = frames.reduce((acc, f) => acc + ((f.size as number) ?? 0), 0);

        await this.trajectoryRepo.updateById(trajectoryId, {
            frames: frames.map(({ cachePath, ...rest }) => rest),
            status: TrajectoryStatus.Processing,
            stats: {
                totalFiles: frames.length,
                totalSize
            }
        });
    }

    private async dispatchJobs(
        frames: ParsedFrame[],
        trajectory: Trajectory,
        teamId: string
    ): Promise<void>{
        await this.dispatchCompressionJobs(frames, trajectory, teamId);
    }

    private async dispatchCompressionJobs(
        frames: ParsedFrame[],
        trajectory: Trajectory,
        teamId: string
    ): Promise<void> {
        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        if (!storageClusterId) {
            logger.warn(`@trajectory-background-processor: skipping compression — no storageClusterId trajectoryId=${trajectory._id}`);
            return;
        }

        await this.compressionQueueService.enqueueBatch(frames.map((frame) => ({
            trajectoryId: trajectory._id,
            teamId,
            teamClusterId: storageClusterId,
            trajectoryName: trajectory.props.name,
            timestep: frame.timestep,
            sourceFramePath: frame.cachePath,
            compressedFramePath: `${frame.cachePath}.zst`,
            objectKey: buildTrajectoryDumpObjectName(trajectory._id, frame.timestep),
            compressionCodec: 'zstd',
            contentType: 'application/zstd',
            contentEncoding: 'zstd'
        })));
    }

    private async updateStatus(
        trajectoryId: string,
        teamId: string,
        status: TrajectoryStatus,
        metadata?: Record<string, unknown>
    ): Promise<void>{
        await this.trajectoryRepo.updateById(trajectoryId, { status });
        await this.eventBus.publish(new TrajectoryUpdatedEvent({
            trajectoryId,
            teamId,
            updates: {
                status,
                ...metadata
            },
            updatedAt: new Date()
        }));
    }

    private async dispatchCloudUploadJobs(
        jobs: CompressionJobData[]
    ): Promise<void>{
        logger.info(`@trajectory-background-processor: Enqueuing ${jobs.length} cloud upload job(s) via BullMQ`);

        await this.cloudUploadQueueService.enqueueBatch(jobs.map((job) => ({
            trajectoryId: job.trajectoryId,
            teamClusterId: job.teamClusterId,
            teamId: job.teamId,
            trajectoryName: job.trajectoryName,
            timestep: job.timestep,
            frameFilePath: job.compressedFramePath,
            objectKey: job.objectKey,
            contentType: job.contentType,
            contentEncoding: job.contentEncoding
        })));

        logger.info(`@trajectory-background-processor: all cloud upload jobs enqueued frameCount=${jobs.length} trajectoryId=${jobs[0]?.trajectoryId}`);
    }

    /**
     * After all dumps have been uploaded, sends a single `trajectory.enqueue-preprocessing`
     * command to the ClusterDaemon with all frame descriptors. The daemon will autonomously
     * enqueue BullMQ GLB conversion jobs.
     *
     * Initializes a Redis session counter so that the server can track when all GLB jobs
     * have settled (drain logic in DaemonAnalysisCompletionService).
     */
    private async enqueueGlbPreprocessing(
        frames: Array<{ timestep: number; [key: string]: unknown }>,
        trajectory: Trajectory,
        teamId: string
    ): Promise<void> {
        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        if (!storageClusterId) {
            logger.warn(`@trajectory-background-processor: skipping GLB enqueue — no storageClusterId trajectoryId=${trajectory._id}`);
            return;
        }

        const computeClusterId = await this.teamClusterSelectionService.resolveComputeClusterId(
            teamId,
            undefined,
            storageClusterId
        );

        const frameDescriptors: GlbFrameDescriptor[] = frames.map((frame) => ({
            timestep: frame.timestep,
            objectKey: this.dumpStorage.getObjectName(trajectory._id, String(frame.timestep)),
            ownerClusterId: storageClusterId
        }));
        const frameDescriptorBatches = chunkItems(frameDescriptors, GLB_ENQUEUE_BATCH_SIZE);

        logger.info(`@trajectory-background-processor: sending trajectory.enqueue-preprocessing to daemon frameCount=${frameDescriptors.length} batchCount=${frameDescriptorBatches.length} trajectoryId=${trajectory._id} computeClusterId=${computeClusterId}`);

        await this.initializeGlbSession(trajectory._id, frameDescriptors.length);

        for (const batch of frameDescriptorBatches) {
            const response = await this.teamClusterDaemonClient.command<GlbPreprocessingEnqueueResult>(
                computeClusterId,
                ChannelCommands.TrajectoryEnqueuePreprocessing,
                {
                    trajectoryId: trajectory._id,
                    teamId,
                    storageClusterId,
                    frames: batch
                },
                {
                    timeoutClass: 'long-running-control-plane'
                }
            );

            if (response.skippedJobs > 0) {
                throw new ApplicationError(
                    'Trajectory::GlbEnqueueSkippedFrames',
                    `Daemon skipped ${response.skippedJobs} GLB frame(s) for trajectory ${trajectory._id}`,
                    500
                );
            }

            await this.daemonAnalysisCompletionService.handleQueuedJobs(
                this.buildQueuedGlbJobs(trajectory, teamId, batch),
                'glb',
                computeClusterId
            ).catch((projectionError) => {
                logger.warn(projectionError, `Failed to project queued GLB jobs for trajectory ${trajectory._id}`);
            });
        }

        logger.info(`@trajectory-background-processor: GLB preprocessing enqueued and session initialized frameCount=${frameDescriptors.length} batchCount=${frameDescriptorBatches.length} trajectoryId=${trajectory._id}`);
    }

    private glbSessionKeys(trajectoryId: string) {
        const base = `daemon-glb:${trajectoryId}`;
        return {
            remaining: `${base}:remaining`,
            failed: `${base}:failed`,
            terminalSet: `${base}:terminal-keys`
        };
    }

    /**
     * Sets up a Redis counter to track how many GLB conversion jobs remain for this trajectory.
     * When all jobs report back (via trajectory.glb-job-status), the drain logic in
     * DaemonAnalysisCompletionService will decrement this counter and finalize the trajectory.
     */
    private async initializeGlbSession(trajectoryId: string, totalJobs: number): Promise<void> {
        const keys = this.glbSessionKeys(trajectoryId);
        const staleReceiptKeys = await this.redis.smembers(keys.terminalSet);

        const pipeline = this.redis.pipeline();
        pipeline.set(keys.remaining, totalJobs.toString(), 'EX', GLB_SESSION_TTL_SECONDS);
        pipeline.del(keys.failed);
        pipeline.del(keys.terminalSet);

        if (staleReceiptKeys.length > 0) {
            pipeline.del(...staleReceiptKeys);
        }

        await pipeline.exec();
    }

    private buildQueuedGlbJobs(
        trajectory: Trajectory,
        teamId: string,
        frameDescriptors: GlbFrameDescriptor[]
    ): Array<{
        jobId: string;
        teamId: string;
        queueType: string;
        name: string;
        trajectoryId: string;
        trajectoryName: string;
        timestep: number;
    }> {
        return frameDescriptors.map((frame) => ({
            jobId: `trajectory-glb:${trajectory._id}:${frame.timestep}`,
            teamId,
            queueType: 'trajectory_glb_conversion',
            name: 'Preprocess trajectory frame',
            trajectoryId: trajectory._id,
            trajectoryName: trajectory.props.name,
            timestep: frame.timestep
        }));
    }

};
