import { get, post } from '../../shared/routing';
import type {
    TriggerRasterizationResponse,
    GetRasterMetadataResponse,
    RasterFramePNGResponse
} from './domain';

export const rasterRoutes = {
    triggerRasterization: post<never, TriggerRasterizationResponse>('/api/teams/:teamId/trajectories/:trajectoryId/rasters/jobs'),
    getRasterMetadata: get<GetRasterMetadataResponse>('/api/teams/:teamId/trajectories/:trajectoryId/rasters/metadata'),
    getRasterFramePNG: get<RasterFramePNGResponse>('/api/teams/:teamId/trajectories/:trajectoryId/rasters/frames/:timestep')
} as const;
