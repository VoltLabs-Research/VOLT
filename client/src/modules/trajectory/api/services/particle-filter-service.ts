import { createService, serviceRoutes } from '@/app/core/http/utils/create-service';
import { ParticleFilterCombinator } from '@volt/contracts/modules/trajectory/http';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';


interface ParticleFilterCondition {
    kind?: 'property';
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number | string;
    exposureId?: string;
}

type FilterAction = 'delete' | 'highlight';

interface ApplyFilterInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number | string;
    exposureId?: string;
    action: FilterAction;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterCondition[];
}

interface ApplyFilterResponse {
    fileId: string;
    atomsResult: number;
    action: string;
}

export interface GetFilterPropertiesInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
}

export interface FilterPropertiesData {
    dump: string[];
    perAtom: Record<string, string[]>;
    perAtomTypes?: Record<string, Record<string, 'number' | 'string'>>;
    exposureNames: Record<string, string>;
}

export interface GetUniqueValuesInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property: string;
    exposureId?: string;
    maxValues?: number;
}

export interface GetUniqueValuesResponse {
    values: Array<number | string>;
}

export interface PreviewFilterInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number | string;
    exposureId?: string;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterCondition[];
}

export interface PreviewFilterResponse {
    matchCount: number;
    totalAtoms: number;
}

export const buildPreviewQuery = (input: PreviewFilterInput) => {
    if (input.conditions && input.conditions.length > 0) {
        return {
            timestep: input.timestep,
            analysisId: input.analysisId,
            combinator: input.combinator,
            conditions: JSON.stringify(input.conditions)
        };
    }

    return {
        timestep: input.timestep,
        analysisId: input.analysisId,
        property: input.property,
        operator: input.operator,
        value: input.value,
        ...(input.exposureId ? { exposureId: input.exposureId } : {})
    };
};

const buildApplyFilterBody = (input: ApplyFilterInput) => {
    if (input.conditions && input.conditions.length > 0) {
        return {
            timestep: String(input.timestep),
            analysisId: input.analysisId,
            action: input.action,
            combinator: input.combinator,
            conditions: input.conditions
        };
    }

    return {
        timestep: String(input.timestep),
        analysisId: input.analysisId,
        action: input.action,
        property: input.property,
        operator: input.operator,
        value: input.value,
        ...(input.exposureId ? { exposureId: input.exposureId } : {})
    };
};

const routes = serviceRoutes('/teams', { rbac: true });

const endpoints = {
    getProperties: routes.route<GetFilterPropertiesInput, FilterPropertiesData>(
        trajectoryRoutes.particleFilterProperties,
        {
            query: ({ timestep, analysisId }) => ({
                timestep,
                analysisId
            })
        }
    ),
    preview: routes.route<PreviewFilterInput, PreviewFilterResponse>(
        trajectoryRoutes.particleFilterPreview,
        {
            query: buildPreviewQuery
        }
    ),
    applyAction: routes.route<ApplyFilterInput, ApplyFilterResponse>(
        trajectoryRoutes.particleFilterApply,
        {
            body: buildApplyFilterBody
        }
    ),
    getUniqueValues: routes.route<GetUniqueValuesInput, GetUniqueValuesResponse>(
        trajectoryRoutes.particleFilterUniqueValues
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
