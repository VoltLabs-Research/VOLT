import { get, post } from '../../shared/routing';
import type {
    TriggerRasterizationResponse,
    GetRasterMetadataResponse,
    RasterFramePNGResponse
} from './domain';

export const rasterRoutes = {
    triggerRasterization: post<never, TriggerRasterizationResponse>('/api/rasters/:teamId/:trajectoryId/jobs'),
    getRasterMetadata: get<GetRasterMetadataResponse>('/api/rasters/:teamId/:trajectoryId/metadata'),
    getRasterFramePNG: get<RasterFramePNGResponse>('/api/rasters/:teamId/:trajectoryId/frames/:timestep'),
    getRasterFrameAnalysisPNG: get<RasterFramePNGResponse>('/api/rasters/:teamId/:trajectoryId/frames/:timestep/:analysisId/:model')
} as const;
