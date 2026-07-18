import { get, post } from '../../shared/routing';
import type {
    TriggerRasterizationResponse,
    GetRasterMetadataResponse,
    RasterFramePNGResponse
} from './domain';

/**
 * Every client-facing raster endpoint, typed by response. All paths are the full
 * wire paths (team-scoped under `/api/rasters/:teamId`), matching the previous
 * `createHttpModule({ basePath: '/api/rasters/:teamId', resource: Resource.RASTER })`
 * routing verbatim. `getRasterFramePNG` (frame only) and `getRasterFrameAnalysisPNG`
 * (analysis + model) are two wire rows mapped to one streaming controller method;
 * both stream a raw `image/png` body.
 */
export const rasterRoutes = {
    triggerRasterization: post<never, TriggerRasterizationResponse>('/api/rasters/:teamId/:trajectoryId/jobs'),
    getRasterMetadata: get<GetRasterMetadataResponse>('/api/rasters/:teamId/:trajectoryId/metadata'),
    getRasterFramePNG: get<RasterFramePNGResponse>('/api/rasters/:teamId/:trajectoryId/frames/:timestep'),
    getRasterFrameAnalysisPNG: get<RasterFramePNGResponse>('/api/rasters/:teamId/:trajectoryId/frames/:timestep/:analysisId/:model')
} as const;
