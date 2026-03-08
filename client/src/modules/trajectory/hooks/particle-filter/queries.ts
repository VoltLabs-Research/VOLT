import {
    buildKeys,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query/create-paginated-query';
import particleFilterService from '../../api/services/particle-filter';
import type { GetFilterPropertiesInputDTO } from '../../api/dtos/get-filter-properties';
import type { GetUniqueValuesInputDTO } from '../../api/dtos/get-unique-values';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    filterProperties: GetFilterPropertiesInputDTO;
    uniqueValues: GetUniqueValuesInputDTO;
}>(BASE_KEY);

export const PARTICLE_FILTER_QUERY_KEYS = {
    filterProperties: () => KEYS.filterProperties(),
    uniqueValues: () => KEYS.uniqueValues(),
    uniqueValuesByParams: (params: GetUniqueValuesInputDTO) => KEYS.uniqueValues(params)
} as const;

export const filterPropertiesQuery = createQuery(KEYS.filterProperties, (params) => particleFilterService.getProperties(params));
export const uniqueValuesQuery = createQuery(KEYS.uniqueValues, (params) => particleFilterService.getUniqueValues(params));

export const buildFilterPropertiesQueryOptions = filterPropertiesQuery.buildOptions;
export const buildUniqueValuesQueryOptions = uniqueValuesQuery.buildOptions;

export const usePreviewFilterMutation = createMutation(particleFilterService.preview);
export const useApplyFilterMutation = createMutation(particleFilterService.applyAction);
