import {
    buildKeys,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query/create-paginated-query';
import colorCodingService from '../../api/services/color-coding';
import type { GetColorCodingPropertiesInputDTO } from '../../api/dtos/get-color-coding-properties';
import type { GetColorCodingStatsInputDTO } from '../../api/dtos/get-color-coding-stats';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    colorCodingProperties: GetColorCodingPropertiesInputDTO;
    colorCodingStats: GetColorCodingStatsInputDTO;
}>(BASE_KEY);

export const COLOR_CODING_QUERY_KEYS = {
    colorCodingProperties: () => KEYS.colorCodingProperties(),
    colorCodingStats: () => KEYS.colorCodingStats()
} as const;

export const colorCodingPropertiesQuery = createQuery(KEYS.colorCodingProperties, (params) => colorCodingService.getProperties(params));
export const colorCodingStatsQuery = createQuery(KEYS.colorCodingStats, (params) => colorCodingService.getStats(params));

export const buildColorCodingPropertiesQueryOptions = colorCodingPropertiesQuery.buildOptions;
export const buildColorCodingStatsQueryOptions = colorCodingStatsQuery.buildOptions;

export const useApplyColorCodingMutation = createMutation(colorCodingService.apply);
