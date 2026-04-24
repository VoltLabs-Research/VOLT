import { defineServiceModule } from '@/shared/api/service-module';
import { get, post } from '@/app/core/http/utilities/create-service';
import type {
    GetRasterMetadataParams,
    GetRasterMetadataResponse
} from '@/modules/raster/api/dtos/get-raster-metadata';
import type {
    TriggerRasterizationParams,
    TriggerRasterizationResponse
} from '@/modules/raster/api/dtos/trigger-rasterization';

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

export default defineServiceModule({
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
    },
    endpoints
});
