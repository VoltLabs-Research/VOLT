import type { RasterFrameResult } from '@modules/raster/domain/port/IRasterFrameReader';

export interface IRasterStorage {
    listPreviewFiles(trajectoryId: string, teamClusterId?: string): AsyncIterable<string>;
    listAnalysisPreviewFiles(trajectoryId: string, analysisId: string, teamClusterId?: string): AsyncIterable<string>;
    getRasterFramePNG(trajectoryId: string, timestep: number, teamClusterId?: string): Promise<RasterFrameResult>;
    getAnalysisRasterFramePNG(
        trajectoryId: string,
        analysisId: string,
        timestep: number,
        model: string,
        teamClusterId?: string
    ): Promise<RasterFrameResult>;
};
