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
    ColorCodingProperties,
    ColorCodingStats,
    GetColorCodingPropertiesInputDTO,
    GetColorCodingStatsInputDTO
} from '../../api/dtos/color-coding';
import colorCodingService from '../../api/services/color-coding';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    colorCodingProperties: GetColorCodingPropertiesInputDTO;
    colorCodingStats: GetColorCodingStatsInputDTO;
}>(BASE_KEY);

export const COLOR_CODING_QUERY_KEYS = {
    colorCodingProperties: KEYS.colorCodingProperties,
    colorCodingStats: KEYS.colorCodingStats
} as const;

type ColorCodingPropertiesOptions = Partial<UseQueryOptions<ColorCodingProperties, Error, ColorCodingProperties>>;
type ColorCodingStatsOptions = Partial<UseQueryOptions<ColorCodingStats, Error, ColorCodingStats>>;

export const colorCodingPropertiesQuery = (
    params: GetColorCodingPropertiesInputDTO,
    options?: ColorCodingPropertiesOptions
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return useQuery<ColorCodingProperties, Error, ColorCodingProperties>({
        ...options,
        queryKey: withAccessMode(mode, KEYS.colorCodingProperties(params)),
        queryFn: () => dataAccess.getColorCodingProperties(params)
    });
};

export const colorCodingStatsQuery = (
    params: GetColorCodingStatsInputDTO,
    options?: ColorCodingStatsOptions
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return useQuery<ColorCodingStats, Error, ColorCodingStats>({
        ...options,
        queryKey: withAccessMode(mode, KEYS.colorCodingStats(params)),
        queryFn: () => dataAccess.getColorCodingStats(params)
    });
};

export const useApplyColorCodingMutation = createMutation(colorCodingService.apply);
