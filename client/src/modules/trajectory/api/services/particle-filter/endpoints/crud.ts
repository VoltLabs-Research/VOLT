import { get, post } from '@/app/core/http/utilities/create-service';
import type {
    ApplyFilterInputDTO,
    ApplyFilterOutputDTO,
    FilterPropertiesData,
    GetFilterPropertiesInputDTO,
    GetUniqueValuesInputDTO,
    GetUniqueValuesOutputDTO,
    PreviewFilterInputDTO,
    PreviewFilterOutputDTO
} from '../../../dtos/particle-filter';

const buildPreviewQuery = (input: PreviewFilterInputDTO) => {
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

export default {
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
