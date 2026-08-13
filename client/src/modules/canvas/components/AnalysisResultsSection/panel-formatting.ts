import type { IPanelColumn, IPanelTable } from '@volt/contracts/modules/plugin/exposure';

/**
 * Formats one cell of a results table. The plugin says which format a column wants;
 * VOLT does not infer it from the column name or from the value's shape.
 */
export const formatPanelValue = (value: unknown, format: IPanelColumn['format']): string => {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
        return String(value);
    }

    if (format === 'integer') {
        return Math.round(numeric).toLocaleString();
    }
    if (format === 'percent') {
        // OVITO writes one decimal ("96.5%"), computed over the same total the plugin
        // reported, so a row here matches a row there.
        return `${(numeric * 100).toFixed(1)}%`;
    }
    if (format === 'decimal') {
        return numeric.toLocaleString(undefined, { maximumFractionDigits: 3 });
    }

    return String(value);
};

/**
 * CSS colour for a row's swatch, or null when the plugin declared no colour for that
 * category.
 *
 * Null is rendered as an empty outline rather than a guessed colour on purpose. The
 * swatch's only job is to tie a row to the geometry it counts; inventing a colour here
 * would make it disagree with the viewport, which is worse than admitting we do not
 * know. VOLT never derives a colour from what the category is called.
 */
export const resolveSwatchColor = (table: IPanelTable, row: Record<string, unknown>): string | null => {
    if (!table.colorBy || !table.colors) {
        return null;
    }

    const category = row[table.colorBy];
    if (typeof category !== 'string' && typeof category !== 'number') {
        return null;
    }

    const declared = table.colors[String(category)];
    if (!declared) {
        return null;
    }

    const [red, green, blue, alpha] = declared;
    const channel = (value: number): number => Math.max(0, Math.min(255, Math.round(value * 255)));
    return `rgba(${channel(red)}, ${channel(green)}, ${channel(blue)}, ${alpha ?? 1})`;
};
