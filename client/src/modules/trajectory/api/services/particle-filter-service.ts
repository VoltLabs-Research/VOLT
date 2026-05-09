import { createService, get, post } from '@/app/core/http/utilities/create-service';

export enum ParticleFilterCombinator {
    And = 'AND',
    Or = 'OR'
}

export interface ParticleFilterConditionDTO {
    kind?: 'property';
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number;
    exposureId?: string;
}

export type FilterAction = 'delete' | 'highlight';

export interface ApplyFilterInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number;
    exposureId?: string;
    action: FilterAction;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
}

export interface ApplyFilterOutputDTO {
    fileId: string;
    atomsResult: number;
    action: string;
}

export interface GetFilterPropertiesInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
}

export interface FilterPropertiesData {
    dump: string[];
    perAtom: Record<string, string[]>;
    exposureNames: Record<string, string>;
}

export interface GetUniqueValuesInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property: string;
    exposureId?: string;
    maxValues?: number;
}

export interface GetUniqueValuesOutputDTO {
    values: number[];
}

export interface PreviewFilterInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number;
    exposureId?: string;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
}

export interface PreviewFilterOutputDTO {
    matchCount: number;
    totalAtoms: number;
}

export const buildPreviewQuery = (input: PreviewFilterInputDTO) => {
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

const buildApplyFilterBody = (input: ApplyFilterInputDTO) => {
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
    getProperties: get<GetFilterPropertiesInputDTO, FilterPropertiesData>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/properties/${analysisId}`
            : `/${trajectoryId}/properties`,
        { query: ({ timestep }) => ({ timestep }) }
    ),
    preview: get<PreviewFilterInputDTO, PreviewFilterOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/previews/${analysisId}`
            : `/${trajectoryId}/previews`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: buildPreviewQuery
        }
    ),
    applyAction: post<ApplyFilterInputDTO, ApplyFilterOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/${analysisId}`
            : `/${trajectoryId}`,
        {
            body: buildApplyFilterBody
        }
    ),
    getUniqueValues: get<GetUniqueValuesInputDTO, GetUniqueValuesOutputDTO>(
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
