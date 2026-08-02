import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { CSSProperties } from 'react';

export type PluginTableColumnConfig = ColumnConfig<Record<string, unknown>>;

const DEFAULT_COLUMN_WIDTH = 120;
const MIN_MOBILE_COLUMN_WIDTH = 44;

export const MOBILE_COLUMN_WIDTH_SCALE = 0.62;

const resolveColumnWidth = (col: PluginTableColumnConfig, widthScale: number): number => {
    const width = col.width ?? DEFAULT_COLUMN_WIDTH;

    if (widthScale === 1) {
        return width;
    }

    return Math.max(MIN_MOBILE_COLUMN_WIDTH, Math.round(width * widthScale));
};

/**
 * Header and body cells must agree on width down to the pixel, so both read
 * their style from here. On mobile the columns are shrunk *and* pinned to a
 * fixed width, keeping the row horizontally scrollable instead of squeezing
 * every column past readability.
 */
export const resolveColumnStyle = (col: PluginTableColumnConfig, widthScale: number): CSSProperties => {
    const width = resolveColumnWidth(col, widthScale);

    return {
        minWidth: `${width}px`,
        flex: widthScale === 1 ? `1 1 ${width}px` : `0 0 ${width}px`
    };
};

export const getTotalColumnsWidth = (columns: PluginTableColumnConfig[], widthScale: number): number => {
    return columns.reduce((sum, col) => sum + resolveColumnWidth(col, widthScale), 0);
};
