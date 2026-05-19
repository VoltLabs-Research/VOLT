import { ANALYSIS_EXECUTION_METADATA_KEY } from './selected-timestep-analysis';

import type { Analysis } from '@/modules/analysis/api/entities/analysis';

const ACRONYMS = new Set(['id', 'url', 'api', 'ui', 'sdk', 'rdf', 'rms', 'pbc', 'xyz']);
const MISSING_VALUE_TOKEN = '__missing__';
const MAX_FIELDS_IN_SUMMARY = 2;
const MAX_STRING_LENGTH = 28;
const MAX_INLINE_ARRAY_ITEMS = 4;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const stableSerialize = (value: unknown): string => {
    if (value === undefined) {
        return 'undefined';
    }

    if (value === null) {
        return 'null';
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }

    if (typeof value === 'string') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
    }

    if (isPlainObject(value)) {
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
    }

    return JSON.stringify(String(value));
};

const formatNumber = (value: number): string => {
    if (!Number.isFinite(value)) {
        return String(value);
    }

    if (Number.isInteger(value)) {
        return String(value);
    }

    return value.toFixed(3).replace(/\.?0+$/, '');
};

const truncateString = (value: string): string => {
    if (value.length <= MAX_STRING_LENGTH) {
        return value;
    }

    return `${value.slice(0, MAX_STRING_LENGTH - 1)}…`;
};

const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') {
        return 'not set';
    }

    if (typeof value === 'boolean') {
        return value ? 'yes' : 'no';
    }

    if (typeof value === 'number') {
        return formatNumber(value);
    }

    if (typeof value === 'string') {
        return truncateString(value);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }

        if (value.every((entry) => typeof entry === 'number')) {
            const numbers = value as number[];
            if (numbers.length <= MAX_INLINE_ARRAY_ITEMS) {
                return `[${numbers.map(formatNumber).join(', ')}]`;
            }
            return `${numbers.length} values`;
        }

        if (value.every((entry) => typeof entry === 'string')) {
            const strings = value as string[];
            if (strings.length <= MAX_INLINE_ARRAY_ITEMS) {
                return strings.map((entry) => truncateString(entry)).join(', ');
            }
            return `${strings.length} values`;
        }

        return `${value.length} values`;
    }

    if (isPlainObject(value)) {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            return '{}';
        }
        return `${keys.length} fields`;
    }

    return truncateString(String(value));
};

const humanizeSegment = (value: string): string => {
    const words = value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-\s]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);

    if (words.length === 0) {
        return value;
    }

    return words
        .map((word, index) => {
            const lower = word.toLowerCase();
            if (ACRONYMS.has(lower)) {
                return lower.toUpperCase();
            }
            if (index === 0) {
                return lower.charAt(0).toUpperCase() + lower.slice(1);
            }
            return lower;
        })
        .join(' ');
};

const humanizePath = (path: string): string => {
    const segments = path
        .split('.')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map(humanizeSegment);

    if (!segments.length) {
        return path;
    }

    if (segments.length === 1) {
        return segments[0];
    }

    return segments.join(' / ');
};

const flattenConfig = (config: Record<string, unknown>): Map<string, unknown> => {
    const flattened = new Map<string, unknown>();

    const walk = (value: unknown, path: string): void => {
        if (isPlainObject(value)) {
            const keys = Object.keys(value);
            if (!keys.length) {
                if (path) {
                    flattened.set(path, {});
                }
                return;
            }

            keys.forEach((key) => {
                if (!path && key === ANALYSIS_EXECUTION_METADATA_KEY) {
                    return;
                }

                const nextPath = path ? `${path}.${key}` : key;
                walk(value[key], nextPath);
            });
            return;
        }

        if (!path) {
            return;
        }

        flattened.set(path, value);
    };

    walk(config, '');
    return flattened;
};

const buildPluginDiffSummaries = (pluginAnalyses: Analysis[]): Map<string, string> => {
    const byAnalysisId = new Map<string, string>();
    if (pluginAnalyses.length < 2) {
        return byAnalysisId;
    }

    const flattenedByAnalysisId = new Map<string, Map<string, unknown>>();
    const allPaths = new Set<string>();

    for (const analysis of pluginAnalyses) {
        const flattened = flattenConfig(analysis.config ?? {});
        flattenedByAnalysisId.set(analysis._id, flattened);
        flattened.forEach((_, path) => {
            allPaths.add(path);
        });
    }

    if (allPaths.size === 0) {
        return byAnalysisId;
    }

    const differingPaths = [...allPaths]
        .filter((path) => {
            const variants = new Set<string>();
            for (const analysis of pluginAnalyses) {
                const flattened = flattenedByAnalysisId.get(analysis._id);
                const hasPath = flattened?.has(path) ?? false;
                if (!hasPath) {
                    variants.add(MISSING_VALUE_TOKEN);
                } else {
                    variants.add(stableSerialize(flattened?.get(path)));
                }

                if (variants.size > 1) {
                    return true;
                }
            }

            return false;
        })
        .sort((left, right) => left.localeCompare(right));

    if (!differingPaths.length) {
        return byAnalysisId;
    }

    for (const analysis of pluginAnalyses) {
        const flattened = flattenedByAnalysisId.get(analysis._id) ?? new Map<string, unknown>();
        const entries = differingPaths.map((path) => {
            return `${humanizePath(path)}: ${formatValue(flattened.has(path) ? flattened.get(path) : undefined)}`;
        });

        if (!entries.length) {
            continue;
        }

        const visibleEntries = entries.slice(0, MAX_FIELDS_IN_SUMMARY);
        const hiddenCount = entries.length - visibleEntries.length;
        const summary = hiddenCount > 0
            ? `${visibleEntries.join(' · ')} · +${hiddenCount} more`
            : visibleEntries.join(' · ');

        byAnalysisId.set(analysis._id, summary);
    }

    return byAnalysisId;
};

export const buildAnalysisConfigDiffSummaryByAnalysisId = (analyses: Analysis[]): Map<string, string> => {
    const byPluginId = new Map<string, Analysis[]>();
    analyses.forEach((analysis) => {
        const bucket = byPluginId.get(analysis.plugin) ?? [];
        bucket.push(analysis);
        byPluginId.set(analysis.plugin, bucket);
    });

    const summaryByAnalysisId = new Map<string, string>();
    byPluginId.forEach((pluginAnalyses) => {
        const pluginSummaries = buildPluginDiffSummaries(pluginAnalyses);
        pluginSummaries.forEach((summary, analysisId) => {
            summaryByAnalysisId.set(analysisId, summary);
        });
    });

    return summaryByAnalysisId;
};
