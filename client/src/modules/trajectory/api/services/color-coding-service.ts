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
        '/trajectories/:trajectoryId/color-codings/properties',
        {
            query: ({ timestep, analysisId }) => ({
                timestep,
                analysisId
            })
        }
    ),
    getStats: get<GetColorCodingStatsInput, ColorCodingStats>(
        '/trajectories/:trajectoryId/color-codings/stats'
    ),
    apply: post<ApplyColorCodingInput, void>(
        '/trajectories/:trajectoryId/color-codings',
        {
            body: ({ timestep, payload, analysisId }) => ({
                ...payload,
                timestep: String(timestep),
                ...(analysisId ? { analysisId } : {})
            }),
            unwrap: 'void'
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
