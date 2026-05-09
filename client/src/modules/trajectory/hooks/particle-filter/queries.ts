import {
    buildKeys,
    createQuery
} from '@/shared/infrastructure/query';
import {
    buildCanvasDataAccess,
    DEFAULT_CANVAS_ACCESS_STATE,
    useCanvasAccessStore,
    withAccessMode
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
    uniqueValues: KEYS.uniqueValues,
    uniqueValuesByParams: KEYS.uniqueValues
} as const;

const currentDataAccess = () => {
    const mode = useCanvasAccessStore.getState().mode;
    return buildCanvasDataAccess({ ...DEFAULT_CANVAS_ACCESS_STATE, mode });
};

const getFilterPropertiesKey = (params: GetFilterPropertiesInputDTO) =>
    withAccessMode(useCanvasAccessStore.getState().mode, KEYS.filterProperties(params));

const getUniqueValuesKey = (params: GetUniqueValuesInputDTO) =>
    withAccessMode(useCanvasAccessStore.getState().mode, KEYS.uniqueValues(params));

export const filterPropertiesQuery = createQuery<GetFilterPropertiesInputDTO, FilterPropertiesData>(
    getFilterPropertiesKey,
    (params) => currentDataAccess().getParticleFilterProperties(params)
);

export const uniqueValuesQuery = createQuery<GetUniqueValuesInputDTO, GetUniqueValuesOutputDTO>(
    getUniqueValuesKey,
    (params) => currentDataAccess().getParticleFilterUniqueValues(params)
);
