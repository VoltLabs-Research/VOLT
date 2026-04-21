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
    ColorCodingProperties,
    ColorCodingStats,
    GetColorCodingPropertiesInputDTO,
    GetColorCodingStatsInputDTO
} from '../../api/dtos/color-coding';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    colorCodingProperties: GetColorCodingPropertiesInputDTO;
    colorCodingStats: GetColorCodingStatsInputDTO;
}>(BASE_KEY);

export const COLOR_CODING_QUERY_KEYS = {
    colorCodingProperties: KEYS.colorCodingProperties,
    colorCodingStats: KEYS.colorCodingStats
} as const;

const currentDataAccess = () => {
    const mode = useCanvasAccessStore.getState().mode;
    return buildCanvasDataAccess({ ...DEFAULT_CANVAS_ACCESS_STATE, mode });
};

const getColorCodingPropertiesKey = (params: GetColorCodingPropertiesInputDTO) =>
    withAccessMode(useCanvasAccessStore.getState().mode, KEYS.colorCodingProperties(params));

const getColorCodingStatsKey = (params: GetColorCodingStatsInputDTO) =>
    withAccessMode(useCanvasAccessStore.getState().mode, KEYS.colorCodingStats(params));

export const colorCodingPropertiesQuery = createQuery<GetColorCodingPropertiesInputDTO, ColorCodingProperties>(
    getColorCodingPropertiesKey,
    (params) => currentDataAccess().getColorCodingProperties(params)
);

export const colorCodingStatsQuery = createQuery<GetColorCodingStatsInputDTO, ColorCodingStats>(
    getColorCodingStatsKey,
    (params) => currentDataAccess().getColorCodingStats(params)
);
