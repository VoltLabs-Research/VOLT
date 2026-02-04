export const DEFAULT_ENTRY: any = { state: 'idle', exposures: [] };

export const computeDifferingConfigFields = (
    analyses: { _id: string; plugin: string; config: Record<string, any> }[]
): Map<string, [string, any][]> => {
    const result = new Map<string, [string, any][]>();
    const byPlugin = new Map<string, typeof analyses>();

    for (const analysis of analyses) {
        const list = byPlugin.get(analysis.plugin) || [];
        list.push(analysis);
        byPlugin.set(analysis.plugin, list);
    }

    for (const [, pluginAnalyses] of byPlugin) {
        if (pluginAnalyses.length <= 1) {
            for (const analysis of pluginAnalyses) {
                const entries = Object.entries(analysis.config || {});
                if (entries.length > 0) result.set(analysis._id, entries);
            }
            continue;
        }

        const allKeys = new Set<string>();
        for (const analysis of pluginAnalyses) {
            Object.keys(analysis.config || {}).forEach((key) => allKeys.add(key));
        }

        const differingKeys = new Set<string>();
        for (const key of allKeys) {
            const values = pluginAnalyses.map((analysis) => JSON.stringify(analysis.config?.[key]));
            if (new Set(values).size > 1) differingKeys.add(key);
        }

        const keysToShow = differingKeys.size > 0 ? differingKeys : allKeys;

        for (const analysis of pluginAnalyses) {
            const entries: [string, any][] = [];
            for (const key of keysToShow) {
                if (analysis.config && key in analysis.config) entries.push([key, analysis.config[key]]);
            }
            if (entries.length > 0) result.set(analysis._id, entries);
        }
    }

    return result;
};

export const formatConfigValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return `[${value.length}]`;
    if (typeof value === 'object') return '{...}';
    return String(value);
};

export const buildArgumentLabelMap = (
    pluginSlug: string,
    getPluginArguments: (slug: string) => { argument: string; label: string }[]
): Map<string, string> => {
    const labelMap = new Map<string, string>();
    const args = getPluginArguments(pluginSlug);
    for (const arg of args) labelMap.set(arg.argument, arg.label);
    return labelMap;
};
