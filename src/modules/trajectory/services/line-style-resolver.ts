import spatialAssembler from '@voltstack/spatial-assembler';
import { resolveCategoryColors } from '@modules/plugin/services/exports/category-colors';
import { resolveEntityCategory, resolveLineOptions } from '@modules/plugin/services/exports/line-exporter';
import { resolveGradientCode } from '@modules/trajectory/services/gradient-codes';

import type {
    LineEntity,
    LineExportOptions
} from '@modules/plugin/services/exports/export-node-processor-types';

export type LineColorMode = 'category' | 'uniform' | 'gradient';
export type LineStyleFilterOperator = 'gte' | 'lte' | 'eq' | 'neq';

export interface LineStyleFilter {
    property: string;
    operator: LineStyleFilterOperator;
    value: number | string;
}

export interface LineStyleInput {
    lineWidth?: number;
    tubularSegments?: number;
    colorMode?: LineColorMode;
    colorProperty?: string;
    categoryColors?: Record<string, [number, number, number, number]>;
    categoryVisibility?: Record<string, boolean>;
    uniformColor?: [number, number, number, number];
    gradient?: string;
    startValue?: number;
    endValue?: number;
    filters?: LineStyleFilter[];
}

export interface ResolvedLineStyle {
    categoryCounts: Record<string, number>;
    getEntityColor: (entity: LineEntity) => [number, number, number, number];
    includeEntity: (entity: LineEntity) => boolean;
}

const FALLBACK_COLOR: [number, number, number, number] = [0.9, 0.2, 0.2, 1];

const numericPropertyValue = (entity: LineEntity, property: string): number => {
    const value = Number(entity[property]);
    return Number.isFinite(value) ? value : 0;
};

const passesFilter = (entity: LineEntity, filter: LineStyleFilter): boolean => {
    const raw = entity[filter.property];
    switch (filter.operator) {
        case 'gte':
            return Number(raw) >= Number(filter.value);
        case 'lte':
            return Number(raw) <= Number(filter.value);
        case 'eq':
            return typeof filter.value === 'number'
                ? Number(raw) === filter.value
                : String(raw ?? '') === filter.value;
        case 'neq':
            return typeof filter.value === 'number'
                ? Number(raw) !== filter.value
                : String(raw ?? '') !== filter.value;
        default:
            return true;
    }
};

export const resolveStyledLineOptions = (
    baseOptions: LineExportOptions,
    style: LineStyleInput
): Required<LineExportOptions> => resolveLineOptions({
    ...baseOptions,
    lineWidth: style.lineWidth ?? baseOptions.lineWidth,
    tubularSegments: style.tubularSegments ?? baseOptions.tubularSegments
});

const countCategories = (lines: LineEntity[], colorProperty: string | undefined): Record<string, number> => {
    const categoryCounts: Record<string, number> = {};
    if (!colorProperty) return categoryCounts;

    for (const line of lines) {
        const category = resolveEntityCategory(line, colorProperty);
        categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    }
    return categoryCounts;
};

const buildGradientColorResolver = (
    lines: LineEntity[],
    colorProperty: string,
    style: LineStyleInput
): (entity: LineEntity) => [number, number, number, number] => {
    const values = new Float32Array(lines.length);
    for (let index = 0; index < lines.length; index += 1) {
        values[index] = numericPropertyValue(lines[index], colorProperty);
    }

    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
        if (value < min) min = value;
        if (value > max) max = value;
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;

    const colors: Float32Array = spatialAssembler.applyPropertyColors(
        values,
        style.startValue ?? min,
        style.endValue ?? max,
        resolveGradientCode(style.gradient ?? 'Viridis')
    );

    const colorByEntity = new Map<LineEntity, [number, number, number, number]>();
    for (let index = 0; index < lines.length; index += 1) {
        colorByEntity.set(lines[index], [
            colors[index * 3],
            colors[index * 3 + 1],
            colors[index * 3 + 2],
            1
        ]);
    }

    return (entity) => colorByEntity.get(entity) ?? FALLBACK_COLOR;
};

const buildEntityColorResolver = (
    lines: LineEntity[],
    colorMode: LineColorMode,
    colorProperty: string | undefined,
    options: Required<LineExportOptions>,
    style: LineStyleInput
): (entity: LineEntity) => [number, number, number, number] => {
    if (colorMode === 'uniform' || !colorProperty) {
        const color = style.uniformColor ?? options.material.baseColor;
        return () => color;
    }

    if (colorMode === 'gradient') {
        return buildGradientColorResolver(lines, colorProperty, style);
    }

    const categoryColors = resolveCategoryColors(
        lines.map((line) => resolveEntityCategory(line, colorProperty)),
        {
            ...options.propertyColors,
            ...style.categoryColors
        }
    );
    return (entity) => (
        categoryColors.get(resolveEntityCategory(entity, colorProperty)) ?? FALLBACK_COLOR
    );
};

const buildEntityInclusion = (
    colorProperty: string | undefined,
    style: LineStyleInput
): (entity: LineEntity) => boolean => {
    const categoryVisibility = style.categoryVisibility;
    const filters = style.filters ?? [];

    return (entity) => {
        if (categoryVisibility && colorProperty) {
            const category = resolveEntityCategory(entity, colorProperty);
            if (categoryVisibility[category] === false) {
                return false;
            }
        }
        return filters.every((filter) => passesFilter(entity, filter));
    };
};

/**
 * Turns a caller-supplied line style into the per-entity colour and visibility hooks the
 * line exporter consumes, plus the category histogram reported back to the caller.
 */
export const resolveLineStyle = (
    lines: LineEntity[],
    options: Required<LineExportOptions>,
    style: LineStyleInput
): ResolvedLineStyle => {
    const colorMode: LineColorMode = style.colorMode ?? (options.colorBy ? 'category' : 'uniform');
    const colorProperty = style.colorProperty
        ?? (options.colorBy.length > 0 ? options.colorBy : undefined);

    return {
        categoryCounts: countCategories(lines, colorProperty),
        getEntityColor: buildEntityColorResolver(lines, colorMode, colorProperty, options, style),
        includeEntity: buildEntityInclusion(colorProperty, style)
    };
};
