import { createService, get, post } from '@/app/core/http/utils/create-service';

import type { GetRasterMetadataResponse, TriggerRasterizationResponse } from '@volt/contracts/modules/raster/domain';

export interface GetRasterMetadataParams {
    trajectoryId: string;
}

export interface TriggerRasterizationParams {
    teamId: string;
    trajectoryId: string;
    config?: unknown;
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
