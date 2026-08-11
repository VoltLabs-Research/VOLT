import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import { currentCanvasDataAccess, currentAccessKey } from '@/modules/canvas/api/access/use-canvas-access-store';
import type {
    ColorCodingProperties,
    ColorCodingStats,
    GetColorCodingPropertiesInput,
    GetColorCodingStatsInput
} from '../../api/services/color-coding-service';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    colorCodingProperties: GetColorCodingPropertiesInput;
    colorCodingStats: GetColorCodingStatsInput;
}>(BASE_KEY);

const getColorCodingPropertiesKey = (params: GetColorCodingPropertiesInput) =>
    currentAccessKey(KEYS.colorCodingProperties(params));

const getColorCodingStatsKey = (params: GetColorCodingStatsInput) =>
    currentAccessKey(KEYS.colorCodingStats(params));

export const colorCodingPropertiesQuery = createQuery<GetColorCodingPropertiesInput, ColorCodingProperties>(
    getColorCodingPropertiesKey,
    (params) => currentCanvasDataAccess().getColorCodingProperties(params)
);

export const colorCodingStatsQuery = createQuery<GetColorCodingStatsInput, ColorCodingStats>(
    getColorCodingStatsKey,
    (params) => currentCanvasDataAccess().getColorCodingStats(params)
);
