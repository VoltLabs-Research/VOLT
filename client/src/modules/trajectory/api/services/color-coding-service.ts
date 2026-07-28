import { createService, get, post } from '@/app/core/http/utils/create-service';

export interface ColorCodingPayload {
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
    exposureId?: string;
}

export interface ApplyColorCodingInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    payload: ColorCodingPayload;
}

export interface GetColorCodingPropertiesInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
}

export interface ColorCodingProperties {
    base: string[];
    modifiers: Record<string, string[]>;
    modifierTypes?: Record<string, Record<string, 'number' | 'string'>>;
}

export interface GetColorCodingStatsInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property: string;
    type: string;
    exposureId?: string;
}

export interface ColorCodingStats {
    min: number;
    max: number;
}

const endpoints = {
    getProperties: get<GetColorCodingPropertiesInput, ColorCodingProperties>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/properties/${analysisId}`
            : `/${trajectoryId}/properties`,
        { query: ({ timestep }) => ({ timestep }) }
    ),
    getStats: get<GetColorCodingStatsInput, ColorCodingStats>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/stats/${analysisId}`
            : `/${trajectoryId}/stats`,
        { omit: ['trajectoryId', 'analysisId'] }
    ),
    apply: post<ApplyColorCodingInput, void>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/${analysisId}`
            : `/${trajectoryId}`,
        {
            body: ({ timestep, payload }) => ({ ...payload, timestep: String(timestep) }),
            unwrap: 'void'
        }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/color-codings',
            useRBAC: true
        }
    }
}, endpoints);
