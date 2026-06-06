import {
    buildKeys,
    createQuery
} from '@/shared/infrastructure/query';
import {
    currentCanvasDataAccess,
    currentAccessKey
} from '@/modules/canvas/api/access';
import type {
    FilterPropertiesData,
    GetFilterPropertiesInputDTO,
    GetUniqueValuesInputDTO,
    GetUniqueValuesOutputDTO
} from '../../api/services/particle-filter-service';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    filterProperties: GetFilterPropertiesInputDTO;
    uniqueValues: GetUniqueValuesInputDTO;
}>(BASE_KEY);

export const PARTICLE_FILTER_QUERY_KEYS = {
    filterProperties: KEYS.filterProperties,
    uniqueValues: KEYS.uniqueValues
} as const;

const getFilterPropertiesKey = (params: GetFilterPropertiesInputDTO) =>
    currentAccessKey(KEYS.filterProperties(params));

const getUniqueValuesKey = (params: GetUniqueValuesInputDTO) =>
    currentAccessKey(KEYS.uniqueValues(params));

export const filterPropertiesQuery = createQuery<GetFilterPropertiesInputDTO, FilterPropertiesData>(
    getFilterPropertiesKey,
    (params) => currentCanvasDataAccess().getParticleFilterProperties(params)
);

export const uniqueValuesQuery = createQuery<GetUniqueValuesInputDTO, GetUniqueValuesOutputDTO>(
    getUniqueValuesKey,
    (params) => currentCanvasDataAccess().getParticleFilterUniqueValues(params)
);
