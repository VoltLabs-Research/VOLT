/**
 * `RasterFrameResult` now lives in the neutral `@shared/contracts/types/RasterFrame`
 * (detachable-modules migration) and is re-exported here so existing
 * `@modules/raster/domain/port/IRasterFrameReader` importers compile unchanged.
 * `IRasterFrameReader` itself stays raster-internal (no cross-module consumer).
 */
export type { RasterFrameResult } from '@shared/contracts/types/RasterFrame';
import type { RasterFrameResult } from '@shared/contracts/types/RasterFrame';

export interface IRasterFrameReader {
    getRasterFramePNG(trajectoryId: string, teamId: string, timestep: number): Promise<RasterFrameResult>;
    getAnalysisRasterFramePNG(
        trajectoryId: string,
        teamId: string,
        analysisId: string,
        timestep: number,
        model: string
    ): Promise<RasterFrameResult>;
}
