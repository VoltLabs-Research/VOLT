import { get, post } from '@/app/core/http/utilities/create-service';
import type { GetFilterPropertiesInputDTO, FilterPropertiesData } from '../../../dtos/get-filter-properties';
import type { PreviewFilterInputDTO, PreviewFilterOutputDTO } from '../../../dtos/preview-filter';
import type { ApplyFilterInputDTO, ApplyFilterOutputDTO } from '../../../dtos/apply-filter';
import type { GetUniqueValuesInputDTO, GetUniqueValuesOutputDTO } from '../../../dtos/get-unique-values';

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
            ? `/${trajectoryId}/unique-values/${analysisId}`
            : `/${trajectoryId}/unique-values`,
        { omit: ['trajectoryId', 'analysisId'] }
    )
};

export default endpoints;
