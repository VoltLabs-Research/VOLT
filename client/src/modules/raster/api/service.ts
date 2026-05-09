import { createService, get, post } from '@/app/core/http/utilities/create-service';
import type { RasterMetadata } from '@/modules/raster/api/entities/raster';

export interface GetRasterMetadataParams {
    trajectoryId: string;
}

export interface GetRasterMetadataResponse {
    metadata: RasterMetadata | null;
}

export interface TriggerRasterizationParams {
    teamId: string;
    trajectoryId: string;
    config?: unknown;
}

export interface TriggerRasterizationResponse {
    trajectoryId: string;
    triggered: boolean;
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
}

const endpoints = {
    triggerRasterization: post<TriggerRasterizationParams, TriggerRasterizationResponse>('/:trajectoryId/jobs', {
        client: 'scoped',
        omit: ['teamId'],
        body: ({ config }) => {
            if (config === undefined) {
                return {};
            }

            return { config };
        }
    }),
    getMetadata: get<GetRasterMetadataParams, GetRasterMetadataResponse>('/:trajectoryId/metadata')
};

export default createService({
    clients: {
        default: {
            basePath: '/rasters',
            useRBAC: true
        },
        scoped: {
            basePath: '/rasters',
            useRBAC: true,
            getTeamId: (params: TriggerRasterizationParams) => params.teamId
        }
    }
}, endpoints);
