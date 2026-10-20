import type { IPanelColumn, IPanelTable } from '@volt/contracts/modules/plugin/exposure';

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
        return `${(numeric * 100).toFixed(1)}%`;
    }
    if (format === 'decimal') {
        return numeric.toLocaleString(undefined, { maximumFractionDigits: 3 });
    }

    return String(value);
};

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
