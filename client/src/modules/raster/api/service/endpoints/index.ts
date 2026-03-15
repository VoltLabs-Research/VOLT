import { download, get, post } from '@/app/core/http/utilities/create-service';
import type {
    GetRasterFrameParams,
    GetRasterMetadataParams,
    GetRasterMetadataResponse,
    GetTrajectoryRasterFrameParams,
    TriggerRasterizationParams,
    TriggerRasterizationResponse
} from '@/modules/raster/api/dtos';

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

export default endpoints;
