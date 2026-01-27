import { create } from 'zustand';
import type { IPluginRecord, IExposureComputed, IArgumentDefinition } from '@/modules/plugins/domain/types';

/**
 * RenderableExposure - Format used by canvas/scene components
 */
export interface RenderableExposure {
    pluginId: string;
    pluginSlug: string;
    analysisId: string;
    exposureId: string;
    modifierId?: string;
    name: string;
    icon?: string;
    results: string;
    canvas: boolean;
    raster: boolean;
    perAtomProperties?: string[];
    export?: {
        exporter?: string;
        type?: string;
        options?: Record<string, unknown>;
    };
}

/**
 * ResolvedModifier - Format used by modifier selectors
 */
export interface ResolvedModifier {
    plugin: IPluginRecord;
    pluginSlug: string;
    name: string;
    icon?: string;
}

export type PluginArgument = IArgumentDefinition;

export interface PluginState {
    pluginsBySlug: Record<string, IPluginRecord>;
    modifiers: ResolvedModifier[];

    registerPlugins: (plugins: IPluginRecord[]) => void;
    getPluginArguments: (pluginSlug: string) => PluginArgument[];
    resetPlugins: () => void;
}

/**
 * Extract modifiers from plugins using backend-computed modifier field
 */
function resolveModifiersFromPlugins(plugins: IPluginRecord[]): ResolvedModifier[] {
    return plugins
        .filter(plugin => plugin.modifier)
        .map(plugin => ({
            plugin,
            pluginSlug: plugin.slug,
            name: plugin.modifier?.name || plugin.slug,
            icon: plugin.modifier?.icon
        }));
}

export const usePluginStore = create<PluginState>((set, get) => ({
    pluginsBySlug: {},
    modifiers: [],

    resetPlugins: () => {
        set({
            pluginsBySlug: {},
            modifiers: [],
        });
    },

    registerPlugins(incomingPlugins: IPluginRecord[]) {
        const state = get();
        const nextPluginsBySlug = { ...state.pluginsBySlug };
        
        let changed = false;
        for (const plugin of incomingPlugins) {
            if (!nextPluginsBySlug[plugin.slug] || nextPluginsBySlug[plugin.slug]._id !== plugin._id) {
                nextPluginsBySlug[plugin.slug] = plugin;
                changed = true;
            }
        }

        if (!changed) return;

        const allPlugins = Object.values(nextPluginsBySlug);
        const nextModifiers = resolveModifiersFromPlugins(allPlugins);

        set({
            pluginsBySlug: nextPluginsBySlug,
            modifiers: nextModifiers
        });
    },

    getPluginArguments(pluginSlug) {
        const plugin = get().pluginsBySlug[pluginSlug];
        return (plugin?.arguments ?? []) as PluginArgument[];
    },
}));
