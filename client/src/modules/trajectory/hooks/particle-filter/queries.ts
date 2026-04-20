import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import {
    buildKeys,
    createMutation
} from '@/shared/infrastructure/query/create-paginated-query';
import {
    useCanvasAccessMode,
    useCanvasDataAccess,
    withAccessMode
} from '@/modules/canvas/api/access';
import type {
    FilterPropertiesData,
    GetFilterPropertiesInputDTO,
    GetUniqueValuesInputDTO,
    GetUniqueValuesOutputDTO
} from '../../api/dtos/particle-filter';
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

type FilterPropertiesOptions = Partial<UseQueryOptions<FilterPropertiesData, Error, FilterPropertiesData>>;
type UniqueValuesOptions = Partial<UseQueryOptions<GetUniqueValuesOutputDTO, Error, GetUniqueValuesOutputDTO>>;

export const filterPropertiesQuery = (
    params: GetFilterPropertiesInputDTO,
    options?: FilterPropertiesOptions
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return useQuery<FilterPropertiesData, Error, FilterPropertiesData>({
        ...options,
        queryKey: withAccessMode(mode, KEYS.filterProperties(params)),
        queryFn: () => dataAccess.getParticleFilterProperties(params)
    });
};

export const uniqueValuesQuery = (
    params: GetUniqueValuesInputDTO,
    options?: UniqueValuesOptions
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return useQuery<GetUniqueValuesOutputDTO, Error, GetUniqueValuesOutputDTO>({
        ...options,
        queryKey: withAccessMode(mode, KEYS.uniqueValues(params)),
        queryFn: () => dataAccess.getParticleFilterUniqueValues(params)
    });
};

export const usePreviewFilterMutation = createMutation(particleFilterService.preview);
export const useApplyFilterMutation = createMutation(particleFilterService.applyAction);
