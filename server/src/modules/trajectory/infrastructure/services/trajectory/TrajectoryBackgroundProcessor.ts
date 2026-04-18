import { getTrajectoryBackgroundProcessorConcurrency } from '@core/config/trajectory';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { normalizeTrajectoryWorkerFailure } from '@modules/trajectory/utilities/trajectory/trajectory-worker-failure';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/trajectory/TrajectoryParserFactory';
import CloudUploadQueueService from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadQueueService';
import CompressionQueueService, { CompressionJobData } from '@modules/trajectory/infrastructure/services/trajectory/CompressionQueueService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';

import { injectable, inject } from 'tsyringe';
import IORedis from 'ioredis';
import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';

import type { ErrorCode } from '@core/constants/error-codes';
import type DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import type { ITrajectoryBackgroundProcessor, ProcessorContext, TrajectoryUploadFile } from '@modules/trajectory/domain/port/trajectory/ITrajectoryBackgroundProcessor';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { ITrajectoryUploadStagingService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryUploadStagingService';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { ExtractedFile } from '@shared/domain/port/IFileExtractorService';
import type { IFileExtractorService } from '@shared/domain/port/IFileExtractorService';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';

type ParsedFrame = {
    timestep: number;
    natoms: number;
    simulationCell: string;
    size: number;
    cachePath: string;
    [key: string]: unknown;
};

interface TeamClusterCommandClient {
    command<T = unknown>(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>,
        options?: { timeoutMs?: number; timeoutClass?: string; }
    ): Promise<T>;
};

interface GlbPreprocessingEnqueueResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
};

const GLB_SESSION_TTL_SECONDS = 86400;
const GLB_ENQUEUE_BATCH_SIZE = 500;

interface GlbFrameDescriptor {
    timestep: number;
    objectKey: string;
    ownerClusterId: string;
};

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

@injectable()
export default class TrajectoryBackgroundProcessor implements ITrajectoryBackgroundProcessor {
    private readonly concurrency = getTrajectoryBackgroundProcessorConcurrency();
    private drainCallbackRegistered = false;
    private compressionDrainCallbackRegistered = false;

    constructor(
        @inject(SHARED_TOKENS.TempFileService)
        private readonly tempFileService: ITempFileService,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly simulationCellRepo: ISimulationCellRepository,

        @inject(TRAJECTORY_TOKENS.CloudUploadQueueService)
        private readonly cloudUploadQueueService: CloudUploadQueueService,

        @inject(TRAJECTORY_TOKENS.CompressionQueueService)
        private readonly compressionQueueService: CompressionQueueService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(SHARED_TOKENS.FileExtractorService)
        private readonly extractor: IFileExtractorService,

        @inject(TRAJECTORY_TOKENS.TrajectoryUploadStagingService)
        private readonly uploadStagingService: ITrajectoryUploadStagingService,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterCommandClient,

        @inject(TeamClusterSelectionService)
        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(TEAM_CLUSTER_TOKENS.DaemonAnalysisCompletionService)
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService
    ){}

    /**
     * Registers the drain callback on CloudUploadQueueService (idempotent).
     * When all upload jobs for a trajectory settle, this triggers GLB preprocessing.
     */
    private registerUploadDrainCallback(): void {
        if (this.drainCallbackRegistered) return;
        this.drainCallbackRegistered = true;

        this.cloudUploadQueueService.onSessionDrain(
            async (trajectoryId, teamId, teamClusterId, _trajectoryName, failedCount, successfulTimesteps) => {
                const trajectory = await this.trajectoryRepo.findById(trajectoryId);
                if (!trajectory) {
                    logger.warn(`@trajectory-background-processor: drain callback — trajectory not found, skipping GLB enqueue trajectoryId=${trajectoryId}`);
                    return;
                }

                const allFrames = (trajectory.props.frames ?? []).map((f) => ({
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

                await this.enqueueGlbPreprocessing(frames, trajectory, teamId);
            }
        );
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

    /**
     * Entry point for trajectory background processing.
     */
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

    /**
     * Creates an isolated working directory for trajectory processing.
     */
    private async createContext(trajectoryId: string): Promise<ProcessorContext>{
        const workingDir = this.tempFileService.getDirPath(`trajectory-uploads/${trajectoryId}`);
        const incomingDir = path.join(workingDir, 'incoming');

        await this.tempFileService.ensureDir(incomingDir);

        return {
            workingDir,
            incomingDir
        };
    }

    /**
     * Removes temporary resources created during processing.
     * Cleanup failures are intentionally ignored.
     */
    private async cleanup(ctx: ProcessorContext){
        await this.tempFileService.delete(ctx.workingDir, {
            recursive: true,
            force: true
        }).catch(() => {});
    }

    /**
     * Loads a trajectory by id or throws if not found.
     */
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

    /**
     * Ensures at lesat one valid frame exists.
     */
    private ensureValidFrames(frames: ParsedFrame[]){
        if(frames.length === 0){
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES,
                'No valid trajectory files were found'
            );
        }
    }

    /**
     * Builds and sort valid trajectory frames.
     * Invalid or failed frames are skipped.
     */
    private async buildFrames(
        trajectoryId: string,
        teamId: string,
        files: ExtractedFile[]
    ): Promise<ParsedFrame[]>{
        const limit = pLimit(this.concurrency);
        const frames = await Promise.all(files.map((file) => {
            return limit(() => this.parseFrame(trajectoryId, teamId, file));
        }));

        return frames
            .filter((frame): frame is ParsedFrame => frame !== null)
            .sort((a, b) => (a.timestep as number) - (b.timestep as number));
    }

    /**
     * Attempts to parse a single trajectory frame.
     * Failures are logged and result in a skipped frame.
     */
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

    /**
     * Attempts to persist a simulation cell.
     * Failure is tolerated and results in a null reference.
     */
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

    /**
     * Persists trajectory frames and statistics.
     */
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

    /**
     * Dispatches all background jobs for a trajectory.
     */
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

    /**
     * Updates trajectory status and emits a domain event.
     */
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

    /**
     * Dispatches cloud upload jobs via BullMQ queue for crash recovery and per-file visibility.
     */    
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

    /**
     * Sets up a Redis counter to track how many GLB conversion jobs remain for this trajectory.
     * When all jobs report back (via trajectory.glb-job-status), the drain logic in
     * DaemonAnalysisCompletionService will decrement this counter and finalize the trajectory.
     */
    private async initializeGlbSession(trajectoryId: string, totalJobs: number): Promise<void> {
        const remainingKey = `daemon-glb:${trajectoryId}:remaining`;
        const failedKey = `daemon-glb:${trajectoryId}:failed`;
        const terminalReceiptSetKey = `daemon-glb:${trajectoryId}:terminal-keys`;
        const staleReceiptKeys = await this.redis.smembers(terminalReceiptSetKey);

        const pipeline = this.redis.pipeline();
        pipeline.set(remainingKey, totalJobs.toString(), 'EX', GLB_SESSION_TTL_SECONDS);
        pipeline.del(failedKey);
        pipeline.del(terminalReceiptSetKey);

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

    private async clearGlbSession(trajectoryId: string): Promise<void> {
        const remainingKey = `daemon-glb:${trajectoryId}:remaining`;
        const failedKey = `daemon-glb:${trajectoryId}:failed`;
        const terminalReceiptSetKey = `daemon-glb:${trajectoryId}:terminal-keys`;
        const staleReceiptKeys = await this.redis.smembers(terminalReceiptSetKey);

        const pipeline = this.redis.pipeline();
        pipeline.del(remainingKey);
        pipeline.del(failedKey);
        pipeline.del(terminalReceiptSetKey);

        if (staleReceiptKeys.length > 0) {
            pipeline.del(...staleReceiptKeys);
        }

        await pipeline.exec();
    }
};
