import { get, post } from '@/app/core/http/utilities/create-service';
import type { GetFilterPropertiesInputDTO, FilterPropertiesData } from '../../../dtos/get-filter-properties';
import type { PreviewFilterInputDTO, PreviewFilterOutputDTO } from '../../../dtos/preview-filter';
import type { ApplyFilterInputDTO, ApplyFilterOutputDTO } from '../../../dtos/apply-filter';
import type { GetUniqueValuesInputDTO, GetUniqueValuesOutputDTO } from '../../../dtos/get-unique-values';

const endpoints = {
    getProperties: get<GetFilterPropertiesInputDTO, FilterPropertiesData>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/properties/${trajectoryId}/${analysisId}`
            : `/properties/${trajectoryId}`,
        { query: ({ timestep }) => ({ timestep }) }
    ),
    preview: get<PreviewFilterInputDTO, PreviewFilterOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/preview/${trajectoryId}/${analysisId}`
            : `/preview/${trajectoryId}`,
        { omit: ['trajectoryId', 'analysisId'] }
    ),
    applyAction: post<ApplyFilterInputDTO, ApplyFilterOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/${analysisId}`
            : `/${trajectoryId}`,
        {
            body: ({ timestep, action, property, operator, value, exposureId }) => ({
                timestep: String(timestep),
                action,
                property,
                operator,
                value,
                ...(exposureId ? { exposureId } : {})
            })
        }
    ),
    getUniqueValues: get<GetUniqueValuesInputDTO, GetUniqueValuesOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/unique-values/${trajectoryId}/${analysisId}`
            : `/unique-values/${trajectoryId}`,
        { omit: ['trajectoryId', 'analysisId'] }
    )
};

export default endpoints;
