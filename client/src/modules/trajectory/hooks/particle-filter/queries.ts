import {
    buildKeys,
    createQuery
} from '@/shared/query';
import {
    currentCanvasDataAccess,
    currentAccessKey
} from '@/modules/canvas/api/access';
import type {
    FilterPropertiesData,
    GetFilterPropertiesInput,
    GetUniqueValuesInput,
    GetUniqueValuesResponse
} from '../../api/services/particle-filter-service';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    filterProperties: GetFilterPropertiesInput;
    uniqueValues: GetUniqueValuesInput;
}>(BASE_KEY);

export const PARTICLE_FILTER_QUERY_KEYS = {
    filterProperties: KEYS.filterProperties,
    uniqueValues: KEYS.uniqueValues
} as const;

const getFilterPropertiesKey = (params: GetFilterPropertiesInput) =>
    currentAccessKey(KEYS.filterProperties(params));

const getUniqueValuesKey = (params: GetUniqueValuesInput) =>
    currentAccessKey(KEYS.uniqueValues(params));

export const filterPropertiesQuery = createQuery<GetFilterPropertiesInput, FilterPropertiesData>(
    getFilterPropertiesKey,
    (params) => currentCanvasDataAccess().getParticleFilterProperties(params)
);

export const uniqueValuesQuery = createQuery<GetUniqueValuesInput, GetUniqueValuesResponse>(
    getUniqueValuesKey,
    (params) => currentCanvasDataAccess().getParticleFilterUniqueValues(params)
);
