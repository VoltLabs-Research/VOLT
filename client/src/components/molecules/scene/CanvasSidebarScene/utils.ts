
export const DEFAULT_ENTRY: any = { state: 'idle', exposures: [] };

export const computeDifferingConfigFields = (
    analyses: { _id: string; plugin: string; config: Record<string, any> }[]
): Map<string, [string, any][]> => {
    const result = new Map<string, [string, any][]>();
    const byPlugin = new Map<string, typeof analyses>();

    for (const a of analyses) {
        const arr = byPlugin.get(a.plugin) || [];
        arr.push(a);
        byPlugin.set(a.plugin, arr);
    }

    for (const [, pluginAnalyses] of byPlugin) {
        if (pluginAnalyses.length <= 1) {
            for (const a of pluginAnalyses) {
                const entries = Object.entries(a.config || {});
                if (entries.length > 0) result.set(a._id, entries);
            }
            continue;
        }

        const allKeys = new Set<string>();
        for (const a of pluginAnalyses) Object.keys(a.config || {}).forEach(k => allKeys.add(k));

        const differingKeys = new Set<string>();
        for (const key of allKeys) {
            const values = pluginAnalyses.map(a => JSON.stringify(a.config?.[key]));
            if (new Set(values).size > 1) differingKeys.add(key);
        }

        for (const a of pluginAnalyses) {
            const entries: [string, any][] = [];
            for (const key of differingKeys) {
                if (a.config && key in a.config) entries.push([key, a.config[key]]);
            }
            if (entries.length > 0) result.set(a._id, entries);
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
