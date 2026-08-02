import { createService, get, post } from '@/app/core/http/utils/create-service';

import type { GetRasterMetadataResponse, TriggerRasterizationResponse } from '@volt/contracts/modules/raster/domain';

export interface GetRasterMetadataParams {
    trajectoryId: string;
}

export interface TriggerRasterizationParams {
    teamId: string;
    trajectoryId: string;
}

const endpoints = {
    triggerRasterization: post<TriggerRasterizationParams, TriggerRasterizationResponse>('/trajectories/:trajectoryId/rasters/jobs', {
        client: 'scoped',
        omit: ['teamId'],
        body: () => ({})
    }),
    getMetadata: get<GetRasterMetadataParams, GetRasterMetadataResponse>('/trajectories/:trajectoryId/rasters/metadata')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        },
        scoped: {
            basePath: '/teams',
            useRBAC: true,
            getTeamId: (params: TriggerRasterizationParams) => params.teamId
        }
    }
}, endpoints);
