import { createService, get, post } from '@/app/core/http/utils/create-service';
import { ParticleFilterCombinator } from '@volt/contracts/modules/trajectory/http';


export interface ParticleFilterCondition {
    kind?: 'property';
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number | string;
    exposureId?: string;
}

export type FilterAction = 'delete' | 'highlight';

export interface ApplyFilterInput {
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

export interface ApplyFilterResponse {
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
            combinator: input.combinator,
            conditions: JSON.stringify(input.conditions)
        };
    }

    return {
        timestep: input.timestep,
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
            action: input.action,
            combinator: input.combinator,
            conditions: input.conditions
        };
    }

    return {
        timestep: String(input.timestep),
        action: input.action,
        property: input.property,
        operator: input.operator,
        value: input.value,
        ...(input.exposureId ? { exposureId: input.exposureId } : {})
    };
};

const endpoints = {
    getProperties: get<GetFilterPropertiesInput, FilterPropertiesData>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/properties/${analysisId}`
            : `/${trajectoryId}/properties`,
        { query: ({ timestep }) => ({ timestep }) }
    ),
    preview: get<PreviewFilterInput, PreviewFilterResponse>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/previews/${analysisId}`
            : `/${trajectoryId}/previews`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: buildPreviewQuery
        }
    ),
    applyAction: post<ApplyFilterInput, ApplyFilterResponse>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/${analysisId}`
            : `/${trajectoryId}`,
        {
            body: buildApplyFilterBody
        }
    ),
    getUniqueValues: get<GetUniqueValuesInput, GetUniqueValuesResponse>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/unique-values/${analysisId}`
            : `/${trajectoryId}/unique-values`,
        { omit: ['trajectoryId', 'analysisId'] }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/particle-filters',
            useRBAC: true
        }
    }
}, endpoints);
