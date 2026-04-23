import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import type {
    RasterAnalysisMetadata,
    RasterFrameMetadata, RasterMetadata, RasterTrajectoryMetadata
} from '@modules/raster/domain/entities/RasterMetadata';
import { RasterMetadataStatus } from '@modules/raster/domain/entities/RasterMetadata';
import { RasterStorageService } from '@modules/raster/infrastructure/services/RasterStorageService';
import { parseAnalysisRasterFrameKey, parseRasterTimestep } from '@modules/raster/utilities/raster-storage-paths';
import {
    resolveAnalysisStorageClusterId,
    resolveTrajectoryStorageClusterId
} from '@modules/team-cluster/application/utilities/cluster-location';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

interface RasterFramesByTimestep {
    [timestep: number]: Set<string>;
};

interface ResolvedTrajectoryRasterMetadata {
    rasterizedFrames: number;
    trajectory: RasterTrajectoryMetadata | null;
};

@Singleton()
export class RasterMetadataService {
    constructor(
        
        private readonly rasterStorage: RasterStorageService,

        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly trajectoryFrameRepository: TrajectoryFrameRepository,

        
        private readonly analysisRepository: AnalysisRepository
    ) {}

    async getRasterMetadata(trajectoryId: string, teamId: string): Promise<RasterMetadata | null> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);

        if (!trajectory || trajectory.props.team !== teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const totalFrames = await this.trajectoryFrameRepository.countFrames(trajectoryId);
        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        const trajectoryRaster = await this.getTrajectoryMetadata(trajectoryId, storageClusterId);

        const analyses = await this.getAnalysesMetadata(trajectoryId, totalFrames);
        const rasterizedFrames = trajectoryRaster.rasterizedFrames;

        if (!trajectoryRaster.trajectory && analyses.length === 0) {
            return null;
        }

        let status = RasterMetadataStatus.Processing;
        if (rasterizedFrames >= totalFrames && totalFrames > 0) {
            status = RasterMetadataStatus.Completed;
        }

        if (!totalFrames && (trajectoryRaster.trajectory || analyses.length > 0)) {
            status = RasterMetadataStatus.Completed;
        }

        return {
            trajectoryId,
            totalFrames,
            rasterizedFrames,
            status,
            trajectory: trajectoryRaster.trajectory,
            analyses,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    private async getTrajectoryMetadata(
        trajectoryId: string,
        teamClusterId?: string
    ): Promise<ResolvedTrajectoryRasterMetadata> {
        const availableTimesteps = new Set<number>();

        try {
            for await (const fileKey of this.rasterStorage.listPreviewFiles(trajectoryId, teamClusterId)) {
                const timestep = parseRasterTimestep(fileKey);
                if (timestep === null) {
                    continue;
                }

                availableTimesteps.add(timestep);
            }
        } catch (error) {
            logger.warn(error, `Failed to list raster previews for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to list raster previews',
                500
            );
        }

        const orderedTimesteps = Array.from(availableTimesteps).sort((leftTimestep, rightTimestep) => leftTimestep - rightTimestep);
        if (!orderedTimesteps.length) {
            return {
                rasterizedFrames: 0,
                trajectory: null
            };
        }

        return {
            rasterizedFrames: orderedTimesteps.length,
            trajectory: {
                availableTimesteps: orderedTimesteps
            }
        };
    }

    private async getAnalysesMetadata(
        trajectoryId: string,
        totalFrames: number
    ): Promise<RasterAnalysisMetadata[]> {
        try {
            const analyses = await this.analysisRepository.export({
                filter: { trajectory: trajectoryId }
            });

            const analysesMetadata = await Promise.all(analyses.map(async (analysis) => {
                return this.getAnalysisMetadata(
                    trajectoryId,
                    analysis._id,
                    totalFrames,
                    resolveAnalysisStorageClusterId(analysis.props)
                );
            }));

            return analysesMetadata.filter((analysis): analysis is RasterAnalysisMetadata => Boolean(analysis));
        } catch (error) {
            logger.warn(error, `Failed to resolve raster analyses metadata for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to resolve raster analyses metadata',
                500
            );
        }
    }

    private async getAnalysisMetadata(
        trajectoryId: string,
        analysisId: string,
        totalFrames: number,
        teamClusterId?: string
    ): Promise<RasterAnalysisMetadata | null> {
        const framesByTimestep: RasterFramesByTimestep = {};

        try {
            for await (const fileKey of this.rasterStorage.listAnalysisPreviewFiles(trajectoryId, analysisId, teamClusterId)) {
                const parsedFrame = parseAnalysisRasterFrameKey(fileKey);
                if (!parsedFrame) {
                    continue;
                }

                const existingModels = framesByTimestep[parsedFrame.timestep] ?? new Set<string>();
                existingModels.add(parsedFrame.model);
                framesByTimestep[parsedFrame.timestep] = existingModels;
            }
        } catch (error) {
            logger.warn(error, `Failed to list raster analysis previews for trajectory ${trajectoryId}, analysis ${analysisId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to list raster analysis previews',
                500
            );
        }

        const frames = Object.keys(framesByTimestep)
            .map((timestep): RasterFrameMetadata => {
                const models = framesByTimestep[Number.parseInt(timestep, 10)] ?? new Set<string>();

                return {
                    timestep: Number.parseInt(timestep, 10),
                    availableModels: Array.from(models).sort((leftModel, rightModel) => leftModel.localeCompare(rightModel))
                };
            })
            .sort((leftFrame, rightFrame) => leftFrame.timestep - rightFrame.timestep);

        if (!frames.length) {
            return null;
        }

        return {
            analysisId,
            totalFrames,
            rasterizedFrames: frames.length,
            availableTimesteps: frames.map((frame) => frame.timestep),
            frames
        };
    }
};
