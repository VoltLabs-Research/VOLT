import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { RasterMetadataStatus } from '@modules/raster/domain/entities/RasterMetadata';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import { parseAnalysisRasterFrameKey, parseRasterTimestep } from '@modules/raster/utilities/raster-storage-paths';
import type { IRasterMetadataReader } from '@modules/raster/domain/port/IRasterMetadataReader';
import type { IRasterStorage } from '@modules/raster/domain/port/IRasterStorage';
import type { RasterMetadata } from '@modules/raster/domain/entities/RasterMetadata';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type {
    RasterAnalysisMetadata,
    RasterFrameMetadata,
    RasterTrajectoryMetadata
} from '@modules/raster/domain/entities/RasterMetadata';

interface RasterFramesByTimestep {
    [timestep: number]: Set<string>;
};

interface ResolvedTrajectoryRasterMetadata {
    rasterizedFrames: number;
    trajectory: RasterTrajectoryMetadata | null;
};

@injectable()
export class RasterMetadataService implements IRasterMetadataReader {
    constructor(
        @inject(RASTER_TOKENS.RasterStorage)
        private readonly rasterStorage: IRasterStorage,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ) {}

    async getRasterMetadata(trajectoryId: string, teamId: string): Promise<RasterMetadata | null> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);

        if (!trajectory || trajectory.props.team !== teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const totalFrames = trajectory.props.frames.length;
        const teamClusterId = trajectory.props.teamCluster;
        const trajectoryRaster = await this.getTrajectoryMetadata(trajectoryId, teamClusterId);

        const analyses = await this.getAnalysesMetadata(trajectoryId, totalFrames, teamClusterId);
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
        totalFrames: number,
        trajectoryTeamClusterId?: string
    ): Promise<RasterAnalysisMetadata[]> {
        try {
            const analyses = await this.analysisRepository.export({
                filter: { trajectory: trajectoryId }
            });

            const analysesMetadata = await Promise.all(analyses.map(async (analysis) => {
                return this.getAnalysisMetadata(
                    trajectoryId,
                    analysis.id,
                    totalFrames,
                    analysis.props.teamCluster || trajectoryTeamClusterId
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
