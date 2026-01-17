import { injectable, inject } from 'tsyringe';
import { ITrajectoryBackgroundProcessor } from '../../domain/port/ITrajectoryBackgroundProcessor';
import TrajectoryParserFactory from '../parsers/TrajectoryParserFactory';
import { ITempFileService } from '@/src/shared/domain/ports/ITempFileService';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import { TRAJECTORY_TOKENS } from '../di/TrajectoryTokens';
import { ITrajectoryRepository } from '../../domain/port/ITrajectoryRepository';

import TrajectoryUpdatedEvent from '../../application/events/TrajectoryUpdatedEvent';
import { ISimulationCellRepository } from '@/src/modules/simulation-cell/domain/ports/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '@/src/modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { IJobQueueService } from '@/src/modules/jobs/domain/ports/IJobQueueService';
import { TrajectoryStatus } from '../../domain/entities/Trajectory';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '@/src/shared/infrastructure/logger';
import { IFileExtractorService } from '@/src/shared/domain/ports/IFileExtractorService';

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
    ) { }

    /**
     * Helper to update trajectory progress and emit event to frontend
     */
    private async updateProgress(
        trajectoryId: string,
        teamId: string,
        stage: 'parsing' | 'processing' | 'uploading' | 'rasterizing' | 'completed' | 'failed',
        current: number,
        total: number,
        message?: string
    ): Promise<void> {
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

        await this.trajectoryRepo.updateById(trajectoryId, {
            processingProgress: {
                stage,
                currentStep: current,
                totalSteps: total,
                percentage,
                message
            }
        });

        await this.eventBus.publish(new TrajectoryUpdatedEvent({
            trajectoryId,
            teamId,
            updates: {
                processingProgress: { stage, currentStep: current, totalSteps: total, percentage, message }
            },
            updatedAt: new Date()
        }));
    }

    public async process(trajectoryId: string, files: any[], teamId: string): Promise<void> {
        const workingDir = this.tempFileService.getDirPath(`trajectory-uploads/${trajectoryId}`);
        await fs.mkdir(workingDir, { recursive: true });

        try {
            // Retrieve trajectory to get name
            const trajectory = await this.trajectoryRepo.findById(trajectoryId);
            if (!trajectory) {
                throw new Error(`Trajectory not found: ${trajectoryId}`);
            }

            // Emit parsing started
            await this.updateProgress(trajectoryId, teamId, 'parsing', 0, files.length, 'Parsing trajectory files');

            const finalFiles = await this.extractor.extractFiles(files, workingDir);
            const validFrames = await this.parseFrames(trajectoryId, teamId, finalFiles);

            if (validFrames.length === 0) {
                await this.updateProgress(trajectoryId, teamId, 'failed', 0, 0, 'No valid frames found');
                await this.updateStatus(trajectoryId, teamId, TrajectoryStatus.Failed);
                return;
            }

            // Emit parsing completed
            await this.updateProgress(trajectoryId, teamId, 'parsing', validFrames.length, validFrames.length, 'Parsing completed');

            // Update Trajectory entity with frames and Processing status
            await this.trajectoryRepo.updateById(trajectoryId, {
                frames: validFrames.map(({ cachePath, ...rest }) => rest) as any,
                status: TrajectoryStatus.Processing,
                stats: {
                    totalFiles: validFrames.length,
                    totalSize: validFrames.reduce((acc, f) => acc + (f.natoms || 0), 0)
                }
            });

            await this.updateStatus(trajectoryId, teamId, TrajectoryStatus.Processing);

            // Emit processing started
            await this.updateProgress(trajectoryId, teamId, 'processing', 0, validFrames.length, 'Processing frames');

            // Dispatch Jobs to queues - EXACTLY LIKE OLD SERVER
            // Note: These jobs are for internal worker processing only, not exposed to frontend
            await this.dispatchTrajectoryJobs(validFrames, trajectory, teamId);
            await this.dispatchCloudUploadJobs(validFrames, trajectory, teamId);

        } catch (error) {
            logger.error(`@trajectory-background-processor: critical error: ${error}`);
            await this.updateProgress(trajectoryId, teamId, 'failed', 0, 0, 'Processing failed');
            await this.updateStatus(trajectoryId, teamId, TrajectoryStatus.Failed);
        } finally {
            await fs.rm(workingDir, { recursive: true, force: true }).catch(() => { });
        }
    }

    private async parseFrames(trajectoryId: string, teamId: string, files: any[]): Promise<any[]> {
        const validFrames: any[] = [];

        for (const file of files) {
            try {
                const result = await TrajectoryParserFactory.parse(file.path);
                if (!result || !result.metadata) continue;

                const { simulationCell, ...restMetadata } = result.metadata;

                const simCellId = await this.createSimulationCell(trajectoryId, teamId, restMetadata.timestep, simulationCell);

                const cachePath = path.join(this.tempFileService.rootPath, 'trajectory-cache', trajectoryId, `${restMetadata.timestep}.dump`);
                await fs.mkdir(path.dirname(cachePath), { recursive: true });
                await fs.copyFile(file.path, cachePath);

                validFrames.push({
                    ...restMetadata,
                    simulationCell: simCellId,
                    cachePath
                });
            } catch (e) {
                logger.error(`@trajectory-background-processor: error parsing file ${file.originalname}: ${e}`);
            }
        }

        return validFrames.sort((a, b) => a.timestep - b.timestep);
    }

    private async createSimulationCell(trajectoryId: string, teamId: string, timestep: number, data: any): Promise<string | null> {
        if (!data) return null;
        try {
            const newSimCell = await this.simulationCellRepo.create({
                ...data,
                team: teamId,
                trajectory: trajectoryId,
                timestep
            });
            return newSimCell.id;
        } catch (e) {
            logger.error(`@trajectory-background-processor: error creating simulation cell for ${trajectoryId}:${timestep}: ${e}`);
            return null;
        }
    }

    /**
     * Dispatch trajectory processing jobs - REPLICATED FROM OLD SERVER PATTERN
     * Creates job objects with exact same structure as old server
     */
    private async dispatchTrajectoryJobs(frames: any[], trajectory: any, teamId: string): Promise<void> {
        const jobs: any[] = [];
        const sessionId = uuidv4();

        for (const frame of frames) {
            const timestep = frame.timestep ?? 0;

            // Extract frameInfo without cachePath (exactly like old server)
            const { cachePath, ...frameInfo } = frame;

            jobs.push({
                jobId: uuidv4(),
                trajectoryId: trajectory.id,
                trajectoryName: trajectory.props.name,
                timestep,
                teamId,
                name: 'Convert to GLB',
                message: trajectory.props.name,
                sessionId,
                sessionStartTime: new Date().toISOString(),
                file: {
                    frameInfo,
                    frameFilePath: cachePath
                },
                folderPath: '',
                tempFolderPath: '',
                queueType: 'trajectory_processing',
                metadata: {
                    trajectoryId: trajectory.id,
                    trajectoryName: trajectory.props.name,
                    timestep,
                    name: 'Convert to GLB',
                    file: {
                        frameInfo,
                        frameFilePath: cachePath
                    }
                }
            });
        }

        logger.info(`@trajectory-background-processor: Dispatching ${jobs.length} trajectory processing jobs for trajectory ${trajectory.id}`);
        await this.processingQueue.addJobs(jobs);
    }

    /**
     * Dispatch cloud upload jobs - REPLICATED FROM OLD SERVER PATTERN
     */
    private async dispatchCloudUploadJobs(frames: any[], trajectory: any, teamId: string): Promise<void> {
        const jobs: any[] = [];
        const sessionId = uuidv4();

        for (const frame of frames) {
            const { cachePath, ...frameInfo } = frame;
            const timestep = frame.timestep ?? 0;

            jobs.push({
                jobId: uuidv4(),
                teamId,
                timestep,
                trajectoryId: trajectory.id,
                trajectoryName: trajectory.props.name,
                name: 'Upload Frame',
                message: trajectory.props.name,
                sessionId,
                sessionStartTime: new Date().toISOString(),
                file: {
                    frameInfo,
                    frameFilePath: cachePath
                },
                queueType: 'cloud-upload',
                metadata: {
                    trajectoryId: trajectory.id,
                    trajectoryName: trajectory.props.name,
                    timestep,
                    name: 'Upload Frame',
                    file: {
                        frameInfo,
                        frameFilePath: cachePath
                    }
                }
            });
        }

        logger.info(`@trajectory-background-processor: Dispatching ${jobs.length} cloud upload jobs for trajectory ${trajectory.id}`);
        await this.cloudUploadQueue.addJobs(jobs);
    }

    private async updateStatus(trajectoryId: string, teamId: string, status: TrajectoryStatus): Promise<void> {
        await this.trajectoryRepo.updateById(trajectoryId, { status });
        await this.eventBus.publish(new TrajectoryUpdatedEvent({
            trajectoryId,
            teamId,
            updates: { status },
            updatedAt: new Date()
        }));
    }
}
