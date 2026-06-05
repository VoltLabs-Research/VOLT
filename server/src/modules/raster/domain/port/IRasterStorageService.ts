import type { RasterFrameResult } from '@modules/raster/domain/port/IRasterFrameReader';

export interface IRasterStorageService {
    hasTrajectoryPreview(trajectoryId: string, teamClusterId: string): Promise<boolean>;
    getRasterFramePNG(trajectoryId: string, timestep: number, teamClusterId: string): Promise<RasterFrameResult>;
    getAnalysisRasterFramePNG(
        trajectoryId: string,
        analysisId: string,
        timestep: number,
        model: string,
        teamClusterId: string
    ): Promise<RasterFrameResult>;
}
