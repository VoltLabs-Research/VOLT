import EditorWidget from '@/components/organisms/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import usePluginStore, { type ManifestsByPluginId } from '@/stores/plugins';
import Select from '@/components/atoms/form/Select';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import type { AnalysisSelectionConfig, AnalysisSelectionField } from '@/types/stores/plugins';
import './AnalysisConfigSelection.css';
import { useCallback, useEffect, useMemo } from 'react';

const TITLE_SEPARATOR = ' · ';
const DESCRIPTION_SEPARATOR = ' · ';
const NUMBER_PRECISION = 2;

const humanizeKey = (key: string): string => {
    if(!key) return '';
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const isDateLike = (value: any): boolean => {
    if(value instanceof Date) return true;
    if(typeof value === 'string'){
        const timestamp = Date.parse(value);
        return !Number.isNaN(timestamp);
    }
    return false;
};

const tryFormatNumber = (value: any): string | null => {
    if(typeof value === 'number' && Number.isFinite(value)){
        return value.toFixed(NUMBER_PRECISION);
    }
    if(typeof value === 'string'){
        const trimmed = value.trim();
        if(!trimmed) return null;
        const parsed = Number(trimmed);
        if(!Number.isNaN(parsed)){
            return parsed.toFixed(NUMBER_PRECISION);
        }
    }
    return null;
};

const formatAutoValue = (value: any): string | null => {
    if(value === undefined || value === null) return null;

    if(typeof value === 'boolean'){
        return value ? 'true' : 'false';
    }

    const numericFormatted = tryFormatNumber(value);
    if(numericFormatted !== null){
        return numericFormatted;
    }

    if(isDateLike(value)){
        const iso = value instanceof Date ? value.toISOString() : String(value);
        return formatTimeAgo(iso);
    }

    if(Array.isArray(value)){
        return value.map((entry) => formatAutoValue(entry) ?? '').filter(Boolean).join(', ');
    }

    if(typeof value === 'object'){
        try{
            return JSON.stringify(value);
        }catch(_err){
            return String(value);
        }
    }

    if(typeof value === 'string'){
        return value.trim() || null;
    }

    return String(value);
};

const getValueByPath = (source: any, path?: string): any => {
    if(!source || !path) return undefined;
    return path.split('.').reduce((acc: any, segment: string) => {
        if(acc == null) return undefined;
        return acc[segment];
    }, source);
};

const matchesVisibleWhen = (analysis: any, visibleWhen?: Record<string, any>): boolean => {
    if(!visibleWhen) return true;
    return Object.entries(visibleWhen).every(([ conditionPath, expectedValue ]) => {
        const actual = getValueByPath(analysis, conditionPath);
        if(Array.isArray(expectedValue)){
            return expectedValue.includes(actual);
        }
        return actual === expectedValue;
    });
};

const getArgumentLabel = (
    manifests: ManifestsByPluginId,
    pluginId: string | undefined,
    key: string
): string => {
    const fallback = humanizeKey(key);
    if(!pluginId) return fallback;
    const argLabel = manifests[pluginId]?.entrypoint?.arguments?.[key]?.label;
    if(typeof argLabel === 'string' && argLabel.trim().length){
        return argLabel;
    }
    return fallback;
};

const formatFieldValue = (
    analysis: any,
    field: AnalysisSelectionField,
    manifests: ManifestsByPluginId,
    includeLabel: boolean
): string | null => {
    if(!field?.path) return null;
    if(!matchesVisibleWhen(analysis, field.visibleWhen)) return null;

    const rawValue = getValueByPath(analysis, field.path);
    const formatted = formatAutoValue(rawValue);
    if(!formatted) return null;
    if(field.label && includeLabel){
        return `${field.label}: ${formatted}`;
    }

    if(includeLabel && field.path){
        const segments = field.path.split('.');
        if(segments[0] === 'config' && segments[1]){
            const label = getArgumentLabel(manifests, analysis?.plugin, segments[1]);
            return `${label}: ${formatted}`;
        }

        const lastSegment = segments[segments.length - 1] ?? field.path;
        const fallbackLabel = humanizeKey(lastSegment);
        if(fallbackLabel){
            return `${fallbackLabel}: ${formatted}`;
        }
    }

    if(!includeLabel && field.path){
        const segments = field.path.split('.');
        if(segments[0] === 'config' && segments[1]){
            const label = getArgumentLabel(manifests, analysis?.plugin, segments[1]);
            if(label){
                return `${label}: ${formatted}`;
            }
        }
    }

    if(includeLabel){
        return `${humanizeKey(field.path)}: ${formatted}`;
    }

    return formatted;
};

const formatTitleFieldValue = (
    analysis: any,
    field: AnalysisSelectionField
): string | null => {
    if(!field?.path) return null;
    if(!matchesVisibleWhen(analysis, field.visibleWhen)) return null;

    const rawValue = getValueByPath(analysis, field.path);
    const formatted = formatAutoValue(rawValue);
    if(!formatted) return null;
    return formatted;
};

const buildTitleFromSelection = (
    analysis: any,
    selection: AnalysisSelectionConfig | undefined
): string | null => {
    const fields = selection?.title;
    if(!fields?.length) return null;
    const resolved = fields
        .map((field) => formatTitleFieldValue(analysis, field))
        .filter((value): value is string => Boolean(value));
    return resolved.length ? resolved.join(TITLE_SEPARATOR) : null;
};

const buildDescriptionFromSelection = (
    analysis: any,
    selection: AnalysisSelectionConfig | undefined,
    manifests: ManifestsByPluginId
): string | null => {
    const fields = selection?.description;
    if(!fields?.length) return null;
    const resolved = fields
        .map((field) => formatFieldValue(analysis, field, manifests, true))
        .filter((value): value is string => Boolean(value));
    return resolved.length ? resolved.join(DESCRIPTION_SEPARATOR) : null;
};

const buildDiffDescription = (
    analysis: any,
    diffKeys: string[],
    manifests: ManifestsByPluginId
): string | null => {
    if(!diffKeys.length) return null;
    const config = analysis?.config ?? {};
    const pluginId = analysis?.plugin;
    const entries = diffKeys
        .map((key) => {
            if(!(key in config)) return null;
            const formattedValue = formatAutoValue(config[key]);
            if(!formattedValue) return null;
            const label = getArgumentLabel(manifests, pluginId, key);
            return `${label}: ${formattedValue}`;
        })
        .filter((value): value is string => Boolean(value));
    return entries.length ? entries.join(DESCRIPTION_SEPARATOR) : null;
};

const getSelectionConfigForAnalysis = (
    analysis: any,
    manifests: ManifestsByPluginId
): AnalysisSelectionConfig | undefined => {
    const pluginId = analysis?.plugin;
    const modifierId = analysis?.modifier;
    if(!pluginId || !modifierId) return undefined;
    return manifests[pluginId]?.modifiers?.[modifierId]?.analysisSelection;
};

const buildDefaultTitle = (analysis: any): string => {
    const configMeta = analysis?.config ?? {};
    const identificationMode =
        configMeta.identificationMode ??
        configMeta.mode ??
        analysis?.modifier ??
        'Unknown';

    const createdLabel = analysis?.createdAt
        ? formatTimeAgo(String(analysis.createdAt))
        : 'Unknown date';

    const rmsdValue = configMeta.RMSD ?? configMeta.rmsd;
    const rmsdLabel =
        identificationMode === 'PTM' && rmsdValue != null
            ? ` (RMSD ${rmsdValue})`
            : '';

    return `${identificationMode} · ${createdLabel}${rmsdLabel}`;
};

const buildDefaultDescription = (analysis: any): string => {
    const configMeta = analysis?.config ?? {};
    const descParts: string[] = [];

    if(typeof configMeta.maxTrialCircuitSize === 'number'){
        descParts.push(`Max Trial Circuit Size: ${configMeta.maxTrialCircuitSize}`);
    }

    if(typeof configMeta.circuitStretchability === 'number'){
        descParts.push(`Circuit Stretchability: ${configMeta.circuitStretchability}`);
    }

    return descParts.join(' · ');
};

const findDifferingConfigKeys = (analyses: any[]): string[] => {
    if(analyses.length <= 1) return [];
    const configs = analyses.map((analysis) => analysis?.config ?? {});
    const keySet = new Set<string>();

    configs.forEach((cfg) => {
        Object.keys(cfg ?? {}).forEach((key) => keySet.add(key));
    });

    const diffs: string[] = [];
    keySet.forEach((key) => {
        const serializedBaseline = JSON.stringify(configs[0]?.[key] ?? null);
        const hasDifference = configs.slice(1).some((cfg) => {
            return JSON.stringify(cfg?.[key] ?? null) !== serializedBaseline;
        });
        if(hasDifference){
            diffs.push(key);
        }
    });

    return diffs;
};

const AnalysisConfigSelection = () => {
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    const isLoading = useTrajectoryStore((s) => s.isLoading);
    const analysisConfig = useAnalysisConfigStore((s) => s.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((s) => s.updateAnalysisConfig);
    const manifests = usePluginStore((s) => s.manifests);
    const fetchManifests = usePluginStore((s) => s.fetchManifests);

    const analysisList = trajectory?.analysis ?? [];

    const getModifierKey = useCallback((analysis: any) => {
        if(!analysis) return 'unknown';
        const plugin = analysis.plugin ?? 'unknown-plugin';
        const modifier = analysis.modifier ?? 'unknown-modifier';
        return `${plugin}::${modifier}`;
    }, []);

    const analysesByModifier = useMemo(() => {
        return (analysisList || []).reduce<Record<string, any[]>>((acc, analysis) => {
            const key = getModifierKey(analysis);
            if(!acc[key]) acc[key] = [];
            acc[key].push(analysis);
            return acc;
        }, {});
    }, [analysisList, getModifierKey]);

    const diffKeysByModifier = useMemo(() => {
        const entries: Record<string, string[]> = {};
        for(const [modifierKey, analyses] of Object.entries(analysesByModifier)){
            entries[modifierKey] = findDifferingConfigKeys(analyses);
        }
        return entries;
    }, [analysesByModifier]);
    const selectedId = analysisConfig?._id ?? '';

    useEffect(() => {
        if(Object.keys(manifests || {}).length === 0){
            fetchManifests();
        }
    }, [manifests, fetchManifests]);

    const handleChange = useCallback((configId: string) => {
        if(!analysisList.length) return;
        const config = analysisList.find(({ _id }) => _id === configId);
        if(config) updateAnalysisConfig(config);
    }, [analysisList, updateAnalysisConfig]);

    const options = useMemo(() => {
        return (analysisList || []).map((analysis: any) => {
            const selectionConfig = getSelectionConfigForAnalysis(analysis, manifests);
            const title =
                buildTitleFromSelection(analysis, selectionConfig) ??
                buildDefaultTitle(analysis);

            const modifierKey = getModifierKey(analysis);
            const modifierGroup = analysesByModifier[modifierKey] ?? [];
            const modifierDiffKeys = diffKeysByModifier[modifierKey] ?? [];
            const shouldShowDiff = modifierGroup.length > 1 && modifierDiffKeys.length > 0;

            const description = shouldShowDiff
                ? (buildDiffDescription(analysis, modifierDiffKeys, manifests) ?? buildDefaultDescription(analysis))
                : (buildDescriptionFromSelection(analysis, selectionConfig, manifests) ?? buildDefaultDescription(analysis));

            return {
                value: analysis._id,
                title,
                description
            };
        });
    }, [analysisList, manifests, analysesByModifier, diffKeysByModifier, getModifierKey]);

    if(isLoading) return null;

    return (
        <EditorWidget className="analysis-config-selection-container">
            <Select
                onDark={true}
                value={selectedId}
                className="analysis-config-select-container"
                onChange={handleChange}
                options={options}
                showSelectionIcon={false}
                disabled={!analysisList.length}
            />
        </EditorWidget>
    );
};

export default AnalysisConfigSelection;
