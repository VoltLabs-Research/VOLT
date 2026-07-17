import { createService, get, post } from '@/app/core/http/utilities/create-service';

import type { LineStyleSpec } from '@/modules/fractal/api/types/scene';
import type { LineEntityRange } from '@/modules/fractal/types/scene-config';

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

export interface GetLineEntityPropertiesResponse {
    entityId: number;
    properties: Record<string, unknown>;
}

const endpoints = {
    apply: post<ApplyLineStyleInput, ApplyLineStyleResponse>(
        ({ trajectoryId, analysisId, exposureId }) => `/${trajectoryId}/${analysisId}/${exposureId}`,
        {
            body: ({ timestep, style }) => ({ timestep: String(timestep), style })
        }
    ),
    getEntityProperties: get<GetLineEntityPropertiesInput, GetLineEntityPropertiesResponse>(
        ({ trajectoryId, analysisId, exposureId, entityId }) => `/${trajectoryId}/${analysisId}/${exposureId}/entities/${entityId}`,
        {
            query: ({ timestep }) => ({ timestep })
        }
    ),
    getRanges: get<GetLineModelRangesInput, GetLineModelRangesResponse>(
        ({ trajectoryId, analysisId, exposureId }) => `/${trajectoryId}/${analysisId}/${exposureId}/ranges`,
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
            basePath: '/line-styles',
            useRBAC: true
        }
    }
}, endpoints);
