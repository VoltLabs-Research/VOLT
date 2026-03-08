import {
    buildKeys,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query/create-paginated-query';
import type { GetFilterPropertiesInputDTO, GetUniqueValuesInputDTO } from '../../api/dtos/particle-filter';
import particleFilterService from '../../api/services/particle-filter';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    filterProperties: GetFilterPropertiesInputDTO;
    uniqueValues: GetUniqueValuesInputDTO;
}>(BASE_KEY);

export const PARTICLE_FILTER_QUERY_KEYS = {
    filterProperties: KEYS.filterProperties,
    uniqueValues: KEYS.uniqueValues,
    uniqueValuesByParams: KEYS.uniqueValues
} as const;

export const filterPropertiesQuery = createQuery(KEYS.filterProperties, particleFilterService.getProperties);
export const uniqueValuesQuery = createQuery(KEYS.uniqueValues, particleFilterService.getUniqueValues);

export const buildFilterPropertiesQueryOptions = filterPropertiesQuery.buildOptions;
export const buildUniqueValuesQueryOptions = uniqueValuesQuery.buildOptions;

export const usePreviewFilterMutation = createMutation(particleFilterService.preview);
export const useApplyFilterMutation = createMutation(particleFilterService.applyAction);
