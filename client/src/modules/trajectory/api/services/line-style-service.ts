import { createService, get, post } from '@/app/core/http/utils/create-service';

import type { LineStyleSpec } from '@/modules/fractal/contracts/scene';
import type { LineEntityRange } from '@/modules/fractal/contracts/scene-config';
import type { GetLineEntityPropertiesResponse } from '@volt/contracts/modules/trajectory/domain';

export interface ApplyLineStyleInput {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    style: LineStyleSpec;
}

export interface ApplyLineStyleResponse {
    objectName: string;
    entitiesRendered: number;
    entitiesTotal: number;
    categoryCounts: Record<string, number>;
}

export interface GetLineEntityPropertiesInput {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    entityId: number;
}

export interface GetLineModelRangesInput {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    style?: LineStyleSpec;
}

export interface GetLineModelRangesResponse {
    version: number;
    entities: LineEntityRange[];
}

const endpoints = {
    apply: post<ApplyLineStyleInput, ApplyLineStyleResponse>(
        ({ trajectoryId, analysisId, exposureId }) => `/trajectories/${trajectoryId}/analyses/${analysisId}/exposures/${exposureId}/line-style`,
        {
            body: ({ timestep, style }) => ({
                timestep: String(timestep),
                style
            })
        }
    ),
    getEntityProperties: get<GetLineEntityPropertiesInput, GetLineEntityPropertiesResponse>(
        ({ trajectoryId, analysisId, exposureId, entityId }) => `/trajectories/${trajectoryId}/analyses/${analysisId}/exposures/${exposureId}/line-style/entities/${entityId}`,
        {
            query: ({ timestep }) => ({ timestep })
        }
    ),
    getRanges: get<GetLineModelRangesInput, GetLineModelRangesResponse>(
        ({ trajectoryId, analysisId, exposureId }) => `/trajectories/${trajectoryId}/analyses/${analysisId}/exposures/${exposureId}/line-style/ranges`,
        {
            query: ({ timestep, style }) => ({
                timestep,
                ...(style ? { style: JSON.stringify(style) } : {})
            })
        }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
