import { createService, get, post } from '@/app/core/http/utilities/create-service';

import type { LineStyleSpec } from '@/modules/fractal/api/entities/scene';
import type { LineEntityRange } from '@/modules/fractal/types/scene-config';

export interface ApplyLineStyleInputDTO {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    style: LineStyleSpec;
}

export interface ApplyLineStyleOutputDTO {
    objectName: string;
    entitiesRendered: number;
    entitiesTotal: number;
    categoryCounts: Record<string, number>;
}

export interface GetLineEntityPropertiesInputDTO {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    entityId: number;
}

export interface GetLineModelRangesInputDTO {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    // Targets a styled model's sidecar; omitted for the exposure's baked GLB.
    style?: LineStyleSpec;
}

export interface GetLineModelRangesOutputDTO {
    version: number;
    entities: LineEntityRange[];
}

export interface GetLineEntityPropertiesOutputDTO {
    entityId: number;
    properties: Record<string, unknown>;
}

const endpoints = {
    apply: post<ApplyLineStyleInputDTO, ApplyLineStyleOutputDTO>(
        ({ trajectoryId, analysisId, exposureId }) => `/${trajectoryId}/${analysisId}/${exposureId}`,
        {
            body: ({ timestep, style }) => ({ timestep: String(timestep), style })
        }
    ),
    getEntityProperties: get<GetLineEntityPropertiesInputDTO, GetLineEntityPropertiesOutputDTO>(
        ({ trajectoryId, analysisId, exposureId, entityId }) => `/${trajectoryId}/${analysisId}/${exposureId}/entities/${entityId}`,
        {
            query: ({ timestep }) => ({ timestep })
        }
    ),
    getRanges: get<GetLineModelRangesInputDTO, GetLineModelRangesOutputDTO>(
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
