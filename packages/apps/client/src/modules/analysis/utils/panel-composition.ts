import { toFiniteNumber } from '@/modules/analysis/utils/run-results';
import { resolveSwatchColor } from '@/modules/canvas/components/AnalysisResultsSection/panel-formatting';
import type { CompositionPart } from '@/modules/analysis/components/charts/CompositionBar';
import type { IPanelTable } from '@volt/contracts/modules/plugin/exposure';

// Neutral steps for categories the plugin gave no color.
const FALLBACK_COLORS = [
    'var(--muted)',
    'color-mix(in oklab, var(--foreground) 35%, transparent)',
    'color-mix(in oklab, var(--foreground) 20%, transparent)'
];

/* A panel table as composition parts: its percent column when it declares one, its first column otherwise. */
export const toCompositionParts = (table: IPanelTable, rows: Record<string, unknown>[]): CompositionPart[] => {
    const column = table.columns.find((entry) => entry.format === 'percent') ?? table.columns[0];
    if (!column) return [];

    const values = rows.map((row) => toFiniteNumber(row[column.column]) ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const asPercent = column.format === 'percent';

    return rows.map((row, index) => ({
        key: String(row[table.label] ?? index),
        label: String(row[table.label] ?? '—'),
        value: asPercent ? values[index] * 100 : total ? (values[index] / total) * 100 : 0,
        color: resolveSwatchColor(table, row) ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]
    }));
};
