import {
    buildKeys,
    createQuery
} from '@/shared/infrastructure/query';
import {
    currentCanvasDataAccess,
    currentAccessKey
} from '@/modules/canvas/api/access';
import type {
    ColorCodingProperties,
    ColorCodingStats,
    GetColorCodingPropertiesInputDTO,
    GetColorCodingStatsInputDTO
} from '../../api/services/color-coding-service';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    colorCodingProperties: GetColorCodingPropertiesInputDTO;
    colorCodingStats: GetColorCodingStatsInputDTO;
}>(BASE_KEY);

export const COLOR_CODING_QUERY_KEYS = {
    colorCodingProperties: KEYS.colorCodingProperties,
    colorCodingStats: KEYS.colorCodingStats
} as const;

const getColorCodingPropertiesKey = (params: GetColorCodingPropertiesInputDTO) =>
    currentAccessKey(KEYS.colorCodingProperties(params));

const getColorCodingStatsKey = (params: GetColorCodingStatsInputDTO) =>
    currentAccessKey(KEYS.colorCodingStats(params));

export const colorCodingPropertiesQuery = createQuery<GetColorCodingPropertiesInputDTO, ColorCodingProperties>(
    getColorCodingPropertiesKey,
    (params) => currentCanvasDataAccess().getColorCodingProperties(params)
);

export const colorCodingStatsQuery = createQuery<GetColorCodingStatsInputDTO, ColorCodingStats>(
    getColorCodingStatsKey,
    (params) => currentCanvasDataAccess().getColorCodingStats(params)
);
