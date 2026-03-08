import { injectable, inject } from 'tsyringe';
import {
    ITrajectoryBackgroundProcessor,
    ProcessorContext,
    TrajectoryUploadFile
} from '@modules/trajectory/domain/port/ITrajectoryBackgroundProcessor';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/TrajectoryParserFactory';
import { ITempFileService } from '@shared/domain/port/ITempFileService';
import type { ExtractedFile } from '@shared/domain/port/IFileExtractorService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/TrajectoryUpdatedEvent';
import { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { IJobQueueService } from '@modules/jobs/domain/port/IJobQueueService';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/Trajectory';
import Trajectory from '@modules/trajectory/domain/entities/Trajectory';
import { v4 } from 'uuid';
import { IFileExtractorService } from '@shared/domain/port/IFileExtractorService';
import { ErrorCodes, type ErrorCode } from '@core/constants/error-codes';
import fs from 'node:fs/promises';
import logger from '@shared/infrastructure/logger';
import path from 'node:path';
import Job from '@modules/jobs/domain/entities/Job';
import {
    normalizeTrajectoryWorkerFailure
} from '@modules/trajectory/infrastructure/workers/trajectory-worker-failure';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

type ParsedFrame = {
    timestep: number;
    natoms: number;
    simulationCell: string;
    size: number;
    cachePath: string;
    [key: string]: unknown;
};

@injectable()
export default class TrajectoryBackgroundProcessor implements ITrajectoryBackgroundProcessor {
    constructor(
        @inject(SHARED_TOKENS.TempFileService)
        private readonly tempFileService: ITempFileService,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly simulationCellRepo: ISimulationCellRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryProcessingQueue)
        private readonly processingQueue: IJobQueueService,

        @inject(TRAJECTORY_TOKENS.CloudUploadQueue)
        private readonly cloudUploadQueue: IJobQueueService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(SHARED_TOKENS.FileExtractorService)
        private readonly extractor: IFileExtractorService
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
        const frames = await Promise.all(files.map(
            (file) => this.parseFrame(trajectoryId, teamId, file)));
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
            const result = await TrajectoryParserFactory.parse(file.path as string);
            const metadata = result?.metadata;
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
        await this.dispatchTrajectoryJobs(frames, trajectory, teamId);
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
     * Dispatches trajectory processing jobs.
     */
    private async dispatchTrajectoryJobs(
        frames: ParsedFrame[],
        trajectory: Trajectory,
        teamId: string
    ): Promise<void>{
        const jobs: Job[] = [];
        const sessionId = v4();

        for(const frame of frames){
            const { cachePath, timestep, ...frameInfo } = frame;
            jobs.push(Job.create({
                jobId: v4(),
                teamId,
                message: trajectory.props.name,
                sessionId,
                queueType: 'trajectory_processing',
                metadata: {
                    trajectoryId: trajectory._id,
                    trajectoryName: trajectory.props.name,
                    timestep,
                    file: {
                        frameInfo,
                        frameFilePath: cachePath
                    }                    
                }
            }));
        }

        logger.info(`@trajectory-background-processor: Dispatching ${jobs.length} trajectory processing jobs`);
        await this.processingQueue.addJobs(jobs);
    }

    /**
     * Dispatches cloud upload jobs.
     */    
    private async dispatchCloudUploadJobs(
        frames: ParsedFrame[],
        trajectory: Trajectory,
        teamId: string
    ): Promise<void>{
        const jobs: Job[] = [];
        const sessionId = v4();

        for(const frame of frames){
            const { cachePath, timestep, ...frameInfo } = frame;
            jobs.push(Job.create({
                jobId: v4(),
                teamId,
                message: trajectory.props.name,
                sessionId,
                queueType: 'cloud-upload',
                metadata: {
                    trajectoryId: trajectory._id,
                    trajectoryName: trajectory.props.name,
                    timestep,
                    file: {
                        frameInfo,
                        frameFilePath: cachePath
                    }
                }
            }));
        }

        logger.info(`@trajectory-background-processor: Dispatching ${jobs.length} cloud upload jobs`);
        await this.cloudUploadQueue.addJobs(jobs);
    }
};
