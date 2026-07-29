import { createService, get, post } from '@/app/core/http/utils/create-service';
import { ParticleFilterCombinator } from '@volt/contracts/modules/trajectory/http';


export interface ParticleFilterCondition {
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

const endpoints = {
    getProperties: get<GetFilterPropertiesInput, FilterPropertiesData>(
        '/trajectories/:trajectoryId/particle-filters/properties',
        {
            query: ({ timestep, analysisId }) => ({
                timestep,
                analysisId
            })
        }
    ),
    preview: get<PreviewFilterInput, PreviewFilterResponse>(
        '/trajectories/:trajectoryId/particle-filters/previews',
        {
            query: buildPreviewQuery
        }
    ),
    applyAction: post<ApplyFilterInput, ApplyFilterResponse>(
        '/trajectories/:trajectoryId/particle-filters',
        {
            body: buildApplyFilterBody
        }
    ),
    getUniqueValues: get<GetUniqueValuesInput, GetUniqueValuesResponse>(
        '/trajectories/:trajectoryId/particle-filters/unique-values'
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
