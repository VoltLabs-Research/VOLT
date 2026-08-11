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
    GetFilterPropertiesInput
} from '../../api/services/particle-filter-service';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    filterProperties: GetFilterPropertiesInput;
}>(BASE_KEY);

const getFilterPropertiesKey = (params: GetFilterPropertiesInput) =>
    currentAccessKey(KEYS.filterProperties(params));

export const filterPropertiesQuery = createQuery<GetFilterPropertiesInput, FilterPropertiesData>(
    getFilterPropertiesKey,
    (params) => currentCanvasDataAccess().getParticleFilterProperties(params)
);
