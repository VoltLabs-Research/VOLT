import { injectable, inject } from 'tsyringe';
import { ITrajectoryBackgroundProcessor, ProcessorContext } from '@modules/trajectory/domain/port/ITrajectoryBackgroundProcessor';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/TrajectoryParserFactory';
import { ITempFileService } from '@shared/domain/ports/ITempFileService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import TrajectoryUpdatedEvent from '@modules/trajectory/application/events/TrajectoryUpdatedEvent';
import { ISimulationCellRepository } from '@modules/simulation-cell/domain/ports/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { IJobQueueService } from '@modules/jobs/domain/ports/IJobQueueService';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/Trajectory';
import { v4 } from 'uuid';
import { IFileExtractorService } from '@shared/domain/ports/IFileExtractorService';
import { ErrorCodes } from '@core/constants/error-codes';
import fs from 'node:fs/promises';
import logger from '@shared/infrastructure/logger';
import path from 'node:path';

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
        files: any[],
        teamId: string
    ): Promise<void>{
        const ctx = await this.createContext(trajectoryId);

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
            logger.error(`@trajectory-background-processor: ${String(error)}`);
            await this.updateStatus(
                trajectoryId,
                teamId,
                TrajectoryStatus.Failed
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
            throw new Error(ErrorCodes.TRAJECTORY_NOT_FOUND);
        }
        return trajectory;
    }

    /**
     * Ensures at lesat one valid frame exists.
     */
    private ensureValidFrames(frames: any[]){
        if(frames.length === 0){
            throw new Error(ErrorCodes.TRAJECTORY_CREATION_NO_VALID_FILES);
        }
    }

    /**
     * Builds and sort valid trajectory frames.
     * Invalid or failed frames are skipped.
     */
    private async buildFrames(
        trajectoryId: string,
        teamId: string,
        files: any[]
    ): Promise<any[]>{
        const frames = await Promise.all(files.map(
            (file) => this.parseFrame(trajectoryId, teamId, file)));
        return frames
            .filter((frame: any) => frame !== null)
            .sort((a: any, b: any) => a.timestep - b.timestep);
    }

    /**
     * Attempts to parse a single trajectory frame.
     * Failures are logged and result in a skipped frame.
     */
    private async parseFrame(
        trajectoryId: string,
        teamId: string,
        file: any
    ): Promise<any | null>{
        try{
            const result = await TrajectoryParserFactory.parse(file.path);
            if (!result?.metadata) return null;

            const headerMetadata = await TrajectoryParserFactory.parseMetadata(file.path);
            const { simulationCell } = headerMetadata;

            const { simulationCell: _, ...metadata } = result.metadata;

            const simulationCellId = await this.createSimulationCell(
                trajectoryId,
                teamId,
                metadata.timestep,
                simulationCell
            );

            const cachePath = await this.cacheFrame(
                trajectoryId,
                metadata.timestep,
                file.path
            );

            return {
                ...metadata,
                size: file.size,
                simulationCell: simulationCellId,
                cachePath
            };
        }catch(error){
            logger.warn(`@trajectory-background-processor: skipping file ${file.originalname}: ${error}`);
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
        data: any
    ): Promise<string | null>{
        if(!data) return null;
        try{
            const cell = await this.simulationCellRepo.create({
                ...data,
                team: teamId,
                trajectory: trajectoryId,
                timestep
            });
            return cell.id;
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
        frames: any[]
    ): Promise<void>{
        const totalSize = frames.reduce((acc, f) => acc + (f.size ?? 0), 0);

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
        frames: any[],
        trajectory: any,
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
        status: TrajectoryStatus
    ): Promise<void>{
        await this.trajectoryRepo.updateById(trajectoryId, { status });
        await this.eventBus.publish(new TrajectoryUpdatedEvent({
            trajectoryId,
            teamId,
            updates: { status },
            updatedAt: new Date()
        }));
    }

    /**
     * Dispatches trajectory processing jobs.
     */
    private async dispatchTrajectoryJobs(
        frames: any[],
        trajectory: any,
        teamId: string
    ): Promise<void>{
        const jobs: any[] = [];
        const sessionId = v4();

        for(const frame of frames){
            const { cachePath, timestep, ...frameInfo } = frame;
            jobs.push({
                jobId: v4(),
                teamId,
                name: 'Convert to GLB',
                message: trajectory.props.name,
                sessionId,
                queueType: 'trajectory_processing',
                metadata: {
                    trajectoryId: trajectory.id,
                    trajectoryName: trajectory.props.name,
                    timestep,
                    file: {
                        frameInfo,
                        frameFilePath: cachePath
                    }                    
                }
            });
        }

        logger.info(`@trajectory-background-processor: Dispatching ${jobs.length} trajectory processing jobs`);
        await this.processingQueue.addJobs(jobs);
    }

    /**
     * Dispatches cloud upload jobs.
     */    
    private async dispatchCloudUploadJobs(
        frames: any[],
        trajectory: any,
        teamId: string
    ): Promise<void>{
        const jobs: any[] = [];
        const sessionId = v4();

        for(const frame of frames){
            const { cachePath, timestep, ...frameInfo } = frame;
            jobs.push({
                jobId: v4(),
                teamId,
                name: 'Upload Frame',
                message: trajectory.props.name,
                sessionId,
                queueType: 'cloud-upload',
                metadata: {
                    trajectoryId: trajectory.id,
                    trajectoryName: trajectory.props.name,
                    timestep,
                    file: {
                        frameInfo,
                        frameFilePath: cachePath
                    }
                }
            });
        }

        logger.info(`@trajectory-background-processor: Dispatching ${jobs.length} cloud upload jobs`);
        await this.cloudUploadQueue.addJobs(jobs);
    }
};