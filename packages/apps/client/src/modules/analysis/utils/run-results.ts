import formatSnakeCaseToTitle from '@/modules/plugin/utils/listing/format-snake-case';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { IPanelTable } from '@volt/contracts/modules/plugin/exposure';
import type { ListingRowByAnalysisData } from '@volt/contracts/modules/plugin/listing';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';

export interface RunMetric {
    key: string;
    label: string;
    varies: boolean;
}

// One exposure's main_listing rows, oldest timestep first.
export interface RunSeries {
    exposureId: string;
    exposureName: string;
    timesteps: number[];
    rows: Record<string, unknown>[];
    metrics: RunMetric[];
}

export interface RunPanelTable {
    exposureId: string;
    table: IPanelTable;
}

export const toFiniteNumber = (value: unknown): number | null => (
    typeof value === 'number' && Number.isFinite(value) ? value : null
);

const numericKeys = (rows: Record<string, unknown>[]): string[] => {
    const keys = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));

    return [...keys].filter((key) => {
        let seen = false;
        for (const row of rows) {
            const value = row[key];
            if (value === null || value === undefined) continue;
            if (toFiniteNumber(value) === null) return false;
            seen = true;
        }
        return seen;
    });
};

const varies = (rows: Record<string, unknown>[], key: string): boolean => {
    const first = rows.find((row) => toFiniteNumber(row[key]) !== null)?.[key];
    return rows.some((row) => toFiniteNumber(row[key]) !== null && row[key] !== first);
};

/*
 * Plugins do not declare which of their listings is the main one, so the series is the exposure whose
 * rows say the most: the one with the most numeric columns that change over the run.
 */
export const buildRunSeries = (rows: ListingRowByAnalysisData[]): RunSeries | null => {
    const byExposure = new Map<string, ListingRowByAnalysisData[]>();
    rows.forEach((row) => {
        const list = byExposure.get(row.exposureId) ?? [];
        list.push(row);
        byExposure.set(row.exposureId, list);
    });

    let best: RunSeries | null = null;
    let bestScore = -1;

    byExposure.forEach((list, exposureId) => {
        const sorted = [...list].sort((left, right) => left.timestep - right.timestep);
        const values = sorted.map((row) => row.row);
        const keys = numericKeys(values);
        const metrics = keys
            .map((key) => ({ key, label: formatSnakeCaseToTitle(key), varies: varies(values, key) }))
            .sort((left, right) => Number(right.varies) - Number(left.varies));
        const score = metrics.filter((metric) => metric.varies).length * 10 + metrics.length;

        if (metrics.length > 0 && score > bestScore) {
            bestScore = score;
            best = {
                exposureId,
                exposureName: sorted[0]?.exposureName ?? '',
                timesteps: sorted.map((row) => row.timestep),
                rows: values,
                metrics
            };
        }
    });

    return best;
};

export const seriesValues = (series: RunSeries, key: string): (number | null)[] => (
    series.rows.map((row) => toFiniteNumber(row[key]))
);

export const listPanelTables = (plugin: Plugin | undefined): RunPanelTable[] => (
    (plugin?.exposures ?? []).flatMap((exposure) => (exposure.panel?.tables ?? []).map((table) => ({
        exposureId: exposure._id,
        table
    })))
);

/* Timesteps of the run: the listing's and the ones its stages ran on, so failed frames keep their place. */
export const resolveRunTimesteps = (analysis: Analysis | undefined, series: RunSeries | null): number[] => {
    const timesteps = new Set<number>(series?.timesteps ?? []);
    (analysis?.stages ?? []).forEach((stage) => {
        if (typeof stage.timestep === 'number') timesteps.add(stage.timestep);
    });

    return [...timesteps].sort((left, right) => left - right);
};

/* The series laid over the run's timesteps; frames without a row read as empty. */
export const alignSeries = (series: RunSeries, timesteps: number[]): RunSeries => {
    const byTimestep = new Map(series.timesteps.map((timestep, index) => [timestep, series.rows[index]]));

    return {
        ...series,
        timesteps,
        rows: timesteps.map((timestep) => byTimestep.get(timestep) ?? {})
    };
};

export const resolveFailedTimesteps = (analysis: Analysis | undefined): Set<number> => {
    const failed = new Set<number>();
    (analysis?.stages ?? []).forEach((stage) => {
        if (stage.status === 'failed' && typeof stage.timestep === 'number') failed.add(stage.timestep);
    });

    return failed;
};

export interface RunSetting {
    label: string;
    value: string;
}

const formatSettingValue = (value: unknown, options?: { key: string; label: string }[]): string | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value ? 'On' : 'Off';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return options?.find((option) => option.key === value)?.label ?? value;
    if (Array.isArray(value) && value.every((item) => typeof item !== 'object')) {
        return value.map((item) => options?.find((option) => option.key === item)?.label ?? String(item)).join(', ');
    }

    return null;
};

/* The run's config, labelled with the plugin's own argument labels; arguments filled from context are left out. */
export const resolveRunSettings = (plugin: Plugin | undefined, analysis: Analysis | undefined): RunSetting[] => {
    const config = analysis?.config ?? {};
    const settings: RunSetting[] = [];

    (plugin?.arguments ?? []).forEach((argument) => {
        if (argument.inferFromContext) return;
        const value = formatSettingValue(config[argument.argument] ?? argument.default, argument.options);
        if (value !== null) settings.push({ label: argument.label || formatSnakeCaseToTitle(argument.argument), value });
    });

    return settings;
};

export const formatRunDuration = (analysis: Analysis | undefined): string | null => {
    if (!analysis?.startedAt || !analysis.finishedAt) return null;
    const seconds = Math.max(0, (new Date(analysis.finishedAt).getTime() - new Date(analysis.startedAt).getTime()) / 1000);
    if (seconds < 60) return `${Math.round(seconds)} s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toFixed(1)} h`;
};

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/* Numbers as a person reads them: grouped integers, three significant decimals, powers of ten past 10⁶. */
export const formatMetric = (value: number | null | undefined): string => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const magnitude = Math.abs(value);

    if (magnitude !== 0 && (magnitude >= 1e6 || magnitude < 1e-3)) {
        const exponent = Math.floor(Math.log10(magnitude));
        const mantissa = value / 10 ** exponent;
        const sign = exponent < 0 ? '⁻' : '';
        const digits = String(Math.abs(exponent)).split('').map((digit) => SUPERSCRIPT[Number(digit)]).join('');
        return `${mantissa.toFixed(2)}×10${sign}${digits}`;
    }

    if (Number.isInteger(value)) return value.toLocaleString('en-US');
    if (magnitude >= 100) return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
    return value.toLocaleString('en-US', { maximumFractionDigits: 3 });
};
