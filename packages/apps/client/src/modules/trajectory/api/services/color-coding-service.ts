import { createService, serviceRoutes } from '@/app/core/http/utils/create-service';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';

interface ColorCodingPayload {
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
    exposureId?: string;
}

interface ApplyColorCodingInput {
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

const routes = serviceRoutes('/teams', { rbac: true });

const endpoints = {
    getProperties: routes.route<GetColorCodingPropertiesInput, ColorCodingProperties>(
        trajectoryRoutes.colorCodingProperties,
        {
            query: ({ timestep, analysisId }) => ({
                timestep,
                analysisId
            })
        }
    ),
    getStats: routes.route<GetColorCodingStatsInput, ColorCodingStats>(
        trajectoryRoutes.colorCodingStats
    ),
    apply: routes.route<ApplyColorCodingInput, void>(
        trajectoryRoutes.colorCodingCreate,
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
