/**
 * Neutral, cross-module port for the raster storage service (streams raster /
 * analysis-raster frame PNGs from a team cluster's object storage).
 *
 * Extracted from `@modules/raster/domain/port/IRasterStorageService` during the
 * detachable-modules migration. The concrete `RasterStorageService` stays in
 * the raster module, registered under `RASTER_CONTRACT_TOKENS.RasterStorageService`
 * (same `Symbol.for('RasterStorageService')` key) so consumers (trajectory)
 * can `@inject(RASTER_CONTRACT_TOKENS.RasterStorageService)` against this port
 * without importing `@modules/raster`. The original port file re-exports this
 * so existing importers compile unchanged.
 */
import type { RasterFrameResult } from '@shared/contracts/types/RasterFrame';

export interface IRasterStorageService {
    getRasterFramePNG(trajectoryId: string, timestep: number, teamClusterId: string): Promise<RasterFrameResult>;
    getAnalysisRasterFramePNG(
        trajectoryId: string,
        analysisId: string,
        timestep: number,
        model: string,
        teamClusterId: string
    ): Promise<RasterFrameResult>;
}
