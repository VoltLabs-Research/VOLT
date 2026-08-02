import { hexToRgba } from './line-style-colors';
import { parseNumericInput } from './parse-numeric-input';

import type { LineStyleSpec } from '@/modules/fractal/contracts/scene';
import type { ColormapName } from '@/modules/fractal/services/colormaps';

/** The line exposure and frame a style request applies to. */
export interface LineStyleTarget {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
}

export interface LineStyleFilterRow {
    id: string;
    property: string;
    operator: 'gte' | 'lte';
    valueInput: string;
}

export interface LineStyleFormState {
    colorMode: NonNullable<LineStyleSpec['colorMode']>;
    categoryProperty: string;
    hiddenCategories: Record<string, boolean>;
    uniformColorHex: string;
    gradientProperty: string;
    gradient: ColormapName;
    startInput: string;
    endInput: string;
    lineWidthInput: string;
    filterRows: LineStyleFilterRow[];
}

/**
 * Translates the line style editor form state into the spec the server bakes.
 * Only fields the user actually filled in are emitted so the server keeps
 * applying its own defaults for the rest.
 */
export const buildLineStyleSpec = (form: LineStyleFormState): LineStyleSpec => {
    const style: LineStyleSpec = { colorMode: form.colorMode };

    const hidden = Object.entries(form.hiddenCategories).filter(([, isHidden]) => isHidden);
    if (hidden.length > 0) {
        style.categoryVisibility = Object.fromEntries(hidden.map(([value]) => [value, false]));
    }

    if (form.colorMode === 'category' && form.categoryProperty) {
        style.colorProperty = form.categoryProperty;
    }

    if (form.colorMode === 'uniform') {
        style.uniformColor = hexToRgba(form.uniformColorHex);
    }

    if (form.colorMode === 'gradient' && form.gradientProperty) {
        style.colorProperty = form.gradientProperty;
        style.gradient = form.gradient;

        const startValue = parseNumericInput(form.startInput);
        if (startValue !== null) {
            style.startValue = startValue;
        }
        const endValue = parseNumericInput(form.endInput);
        if (endValue !== null) {
            style.endValue = endValue;
        }
    }

    const lineWidth = parseNumericInput(form.lineWidthInput);
    if (lineWidth !== null && lineWidth > 0) {
        style.lineWidth = lineWidth;
    }

    const filters = form.filterRows.flatMap((row) => {
        const value = parseNumericInput(row.valueInput);
        if (!row.property || value === null) {
            return [];
        }
        return [{
            property: row.property,
            operator: row.operator,
            value
        }];
    });
    if (filters.length > 0) {
        style.filters = filters;
    }

    return style;
};
