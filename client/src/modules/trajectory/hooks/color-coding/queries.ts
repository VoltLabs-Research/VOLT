import {
    buildKeys,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query/create-paginated-query';
import type { GetColorCodingPropertiesInputDTO, GetColorCodingStatsInputDTO } from '../../api/dtos/color-coding';
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

export const colorCodingPropertiesQuery = createQuery(KEYS.colorCodingProperties, colorCodingService.getProperties);
export const colorCodingStatsQuery = createQuery(KEYS.colorCodingStats, colorCodingService.getStats);

export const buildColorCodingPropertiesQueryOptions = colorCodingPropertiesQuery.buildOptions;
export const buildColorCodingStatsQueryOptions = colorCodingStatsQuery.buildOptions;

export const useApplyColorCodingMutation = createMutation(colorCodingService.apply);
