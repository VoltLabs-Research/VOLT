import { defineServiceModule } from '@/shared/api/service-module';
import { download, get, post } from '@/app/core/http/utilities/create-service';
import type { GetRasterFrameParams } from '@/modules/raster/api/dtos/get-raster-frame';
import type {
    GetRasterMetadataParams,
    GetRasterMetadataResponse
} from '@/modules/raster/api/dtos/get-raster-metadata';
import type { GetTrajectoryRasterFrameParams } from '@/modules/raster/api/dtos/get-trajectory-raster-frame';
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
    getMetadata: get<GetRasterMetadataParams, GetRasterMetadataResponse>('/:trajectoryId/metadata'),
    getTrajectoryFrame: download<GetTrajectoryRasterFrameParams>('GET', '/:trajectoryId/frames/:timestep'),
    getFrame: download<GetRasterFrameParams>('GET', '/:trajectoryId/frames/:timestep/:analysisId/:model')
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
