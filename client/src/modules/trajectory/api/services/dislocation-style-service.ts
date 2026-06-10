import { createService, post } from '@/app/core/http/utilities/create-service';

import type { DislocationStyleSpec } from '@/modules/fractal/api/entities/scene';

export interface ApplyDislocationStyleInputDTO {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    style: DislocationStyleSpec;
}

export interface DislocationFamilySummary {
    count: number;
    totalLength: number;
}

export interface ApplyDislocationStyleOutputDTO {
    objectName: string;
    segmentsRendered: number;
    segmentsTotal: number;
    familyCounts: Record<string, DislocationFamilySummary>;
}

const endpoints = {
    apply: post<ApplyDislocationStyleInputDTO, ApplyDislocationStyleOutputDTO>(
        ({ trajectoryId, analysisId, exposureId }) => `/${trajectoryId}/${analysisId}/${exposureId}`,
        {
            body: ({ timestep, style }) => ({ timestep: String(timestep), style })
        }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/dislocation-styles',
            useRBAC: true
        }
    }
}, endpoints);
