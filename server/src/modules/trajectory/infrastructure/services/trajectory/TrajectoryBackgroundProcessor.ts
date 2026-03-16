import { getTrajectoryBackgroundProcessorConcurrency } from '@core/config/trajectory';
import { ErrorCodes } from '@core/constants/error-codes';
import { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { ITrajectoryBackgroundProcessor, ProcessorContext, TrajectoryUploadFile } from '@modules/trajectory/domain/port/trajectory/ITrajectoryBackgroundProcessor';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { normalizeTrajectoryWorkerFailure } from '@modules/trajectory/utilities/trajectory/trajectory-worker-failure';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IFileExtractorService } from '@shared/domain/port/IFileExtractorService';
import { ITempFileService } from '@shared/domain/port/ITempFileService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/trajectory/TrajectoryParserFactory';
import CloudUploadProcessor from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadProcessor';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';

import { injectable, inject } from 'tsyringe';
import IORedis from 'ioredis';
import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';

import type { ErrorCode } from '@core/constants/error-codes';
import type { ExtractedFile } from '@shared/domain/port/IFileExtractorService';

type ParsedFrame = {
    timestep: number;
    natoms: number;
    simulationCell: string;
    size: number;
    cachePath: string;
    [key: string]: unknown;
};

interface TeamClusterCommandClient {
    command(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<unknown>;
};

const GLB_SESSION_TTL_SECONDS = 86400;

@injectable()
export default class TrajectoryBackgroundProcessor implements ITrajectoryBackgroundProcessor {
    private readonly concurrency = getTrajectoryBackgroundProcessorConcurrency();

    constructor(
        @inject(SHARED_TOKENS.TempFileService)
        private readonly tempFileService: ITempFileService,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly simulationCellRepo: ISimulationCellRepository,

        @inject(TRAJECTORY_TOKENS.CloudUploadProcessor)
        private readonly cloudUploadProcessor: CloudUploadProcessor,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(SHARED_TOKENS.FileExtractorService)
        private readonly extractor: IFileExtractorService,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterCommandClient,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ){}

    /**
     * Entry point for trajectory background processing.
     */
    public async process(
        trajectoryId: string,
        files: TrajectoryUploadFile[],
        teamId: string
    ): Promise<void>{
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
            
            const extractedFiles = await this.extractor.extractFiles(files, ctx.workingDir);
            const frames = await this.buildFrames(trajectoryId, teamId, extractedFiles);
            this.ensureValidFrames(frames);

            await this.persistTrajectory(trajectoryId, frames);
            await this.dispatchJobs(frames, trajectory, teamId);
            await this.enqueueGlbPreprocessing(frames, trajectory, teamId);
            // Status stays at Processing — the daemon will report GLB job completions
            // via trajectory.glb-job-status, and the session drain logic in
            // DaemonAnalysisCompletionService will mark the trajectory as Completed
            // once all GLB conversion jobs have settled.
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
            logger.warn({
                failureCode,
                failureDetails,
                trajectoryId
            }, '@trajectory-background-processor: marking trajectory as failed');
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
     * Creates an insolated working directory for trajectory processing.
     */
    private async createContext(trajectoryId: string): Promise<ProcessorContext>{
        const workingDir = this.tempFileService.getDirPath(`trajectory-uploads/${trajectoryId}`);
        await fs.mkdir(workingDir, { recursive: true });
        return { workingDir };
    }

    /**
     * Removes temporary resources created during processing.
     * Cleanup failures are intentionally ignored.
     */
    private async cleanup(ctx: ProcessorContext){
        await fs.rm(ctx.workingDir, {
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
     * Copies a frame file into the trajectory cache.
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
        await fs.copyFile(sourcePath, cachePath);

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
        await this.dispatchCloudUploadJobs(frames, trajectory, teamId);
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
     * Dispatches cloud upload jobs.
     */    
    private async dispatchCloudUploadJobs(
        frames: ParsedFrame[],
        trajectory: Trajectory,
        teamId: string
    ): Promise<void>{
        logger.info(`@trajectory-background-processor: Uploading ${frames.length} trajectory frame(s) directly`);
        const limit = pLimit(this.concurrency);

        await Promise.all(frames.map((frame) => {
            const { cachePath, timestep } = frame;
            const cloudUploadTask = {
                trajectoryId: trajectory._id,
                teamClusterId: trajectory.props.teamCluster,
                teamId,
                trajectoryName: trajectory.props.name,
                timestep,
                frameFilePath: cachePath
            };

            return limit(() => this.cloudUploadProcessor.process(cloudUploadTask));
        }));
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
        frames: ParsedFrame[],
        trajectory: Trajectory,
        teamId: string
    ): Promise<void> {
        const teamClusterId = trajectory.props.teamCluster;
        if (!teamClusterId) {
            logger.warn(
                { trajectoryId: trajectory._id },
                '@trajectory-background-processor: skipping GLB enqueue — no teamClusterId'
            );
            return;
        }

        const frameDescriptors = frames.map((frame) => ({
            timestep: frame.timestep,
            objectKey: this.dumpStorage.getObjectName(trajectory._id, String(frame.timestep))
        }));

        logger.info(
            {
                frameCount: frameDescriptors.length,
                trajectoryId: trajectory._id,
                teamClusterId
            },
            '@trajectory-background-processor: sending trajectory.enqueue-preprocessing to daemon'
        );

        await this.teamClusterDaemonClient.command(teamClusterId, 'trajectory.enqueue-preprocessing', {
            trajectoryId: trajectory._id,
            teamId,
            trajectoryName: trajectory.props.name,
            frames: frameDescriptors
        });

        // Initialize GLB session counter for drain tracking
        await this.initializeGlbSession(trajectory._id, frameDescriptors.length);

        logger.info(
            {
                frameCount: frameDescriptors.length,
                trajectoryId: trajectory._id
            },
            '@trajectory-background-processor: GLB preprocessing enqueued and session initialized'
        );
    }

    /**
     * Sets up a Redis counter to track how many GLB conversion jobs remain for this trajectory.
     * When all jobs report back (via trajectory.glb-job-status), the drain logic in
     * DaemonAnalysisCompletionService will decrement this counter and finalize the trajectory.
     */
    private async initializeGlbSession(trajectoryId: string, totalJobs: number): Promise<void> {
        const remainingKey = `daemon-glb:${trajectoryId}:remaining`;
        const failedKey = `daemon-glb:${trajectoryId}:failed`;

        const pipeline = this.redis.pipeline();
        pipeline.set(remainingKey, totalJobs.toString(), 'EX', GLB_SESSION_TTL_SECONDS);
        pipeline.del(failedKey);
        await pipeline.exec();

        logger.info(
            `@trajectory-background-processor: initialized GLB session for trajectory ${trajectoryId} with ${totalJobs} jobs`
        );
    }
};
