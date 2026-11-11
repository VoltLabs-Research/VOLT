// The canvas's "Add plugin…" menu, in sections: the built-in stages first, then the plugins by the
// category their manifest gives (modifier.category), the usual ones in a fixed order, any other
// alphabetically, and the plugins with none last. Names sort alphabetically within a section.

export interface PluginPickerEntry {
    id: string;
    label: string;
}

export interface PluginPickerPlugin extends PluginPickerEntry {
    category?: string;
}

export interface PluginPickerSection {
    id: string;
    label: string;
    entries: PluginPickerEntry[];
}

export const PLUGIN_CATEGORY_ORDER = [
    'Structure identification',
    'Local order',
    'Defects',
    'Deformation',
    'Clustering'
];

const BUILT_IN_SECTION = 'Scene';
const UNCATEGORIZED = 'Other';

const byLabel = (a: PluginPickerEntry, b: PluginPickerEntry) => a.label.localeCompare(b.label);

const categoryRank = (category: string) => {
    if (category === UNCATEGORIZED) return PLUGIN_CATEGORY_ORDER.length + 1;
    const index = PLUGIN_CATEGORY_ORDER.indexOf(category);
    return index < 0 ? PLUGIN_CATEGORY_ORDER.length : index;
};

export const buildPluginPickerSections = (
    builtIns: PluginPickerEntry[],
    plugins: PluginPickerPlugin[]
): PluginPickerSection[] => {
    const byCategory = new Map<string, PluginPickerEntry[]>();
    for (const plugin of plugins) {
        const category = plugin.category?.trim() || UNCATEGORIZED;
        const entries = byCategory.get(category) ?? [];
        entries.push({ id: plugin.id, label: plugin.label });
        byCategory.set(category, entries);
    }

    const categories = [...byCategory.entries()]
        .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b))
        .map(([category, entries]) => ({
            id: `category:${category}`,
            label: category,
            entries: entries.sort(byLabel)
        }));

    return [
        { id: 'built-in', label: BUILT_IN_SECTION, entries: builtIns },
        ...categories
    ].filter((section) => section.entries.length > 0);
};
