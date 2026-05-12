import { createService, get, post } from '@/app/core/http/utilities/create-service';

export interface ColorCodingPayload {
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
    exposureId?: string;
}

export interface ApplyColorCodingInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    payload: ColorCodingPayload;
}

export interface GetColorCodingPropertiesInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
}

export interface ColorCodingProperties {
    base: string[];
    modifiers: Record<string, string[]>;
    modifierTypes?: Record<string, Record<string, 'number' | 'string'>>;
}

export interface GetColorCodingStatsInputDTO {
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
    getProperties: get<GetColorCodingPropertiesInputDTO, ColorCodingProperties>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/properties/${analysisId}`
            : `/${trajectoryId}/properties`,
        { query: ({ timestep }) => ({ timestep }) }
    ),
    getStats: get<GetColorCodingStatsInputDTO, ColorCodingStats>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/stats/${analysisId}`
            : `/${trajectoryId}/stats`,
        { omit: ['trajectoryId', 'analysisId'] }
    ),
    apply: post<ApplyColorCodingInputDTO, void>(
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
