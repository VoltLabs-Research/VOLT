import { get } from '@/app/core/http/utilities/create-service';
import type {
    FilterPropertiesData,
    GetFilterPropertiesInputDTO,
    GetUniqueValuesInputDTO,
    GetUniqueValuesOutputDTO,
    PreviewFilterInputDTO,
    PreviewFilterOutputDTO
} from '@/modules/trajectory/api/dtos/particle-filter';

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

export default {
    getParticleFilterProperties: get<GetFilterPropertiesInputDTO, FilterPropertiesData>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/particle-filter/properties/${analysisId}`
            : `/${trajectoryId}/particle-filter/properties`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: ({ timestep }) => ({ timestep })
        }
    ),
    getParticleFilterUniqueValues: get<GetUniqueValuesInputDTO, GetUniqueValuesOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/particle-filter/unique-values/${analysisId}`
            : `/${trajectoryId}/particle-filter/unique-values`,
        {
            omit: ['trajectoryId', 'analysisId']
        }
    ),
    getParticleFilterPreview: get<PreviewFilterInputDTO, PreviewFilterOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/particle-filter/preview/${analysisId}`
            : `/${trajectoryId}/particle-filter/preview`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: buildPreviewQuery
        }
    )
};
