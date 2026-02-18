import { create } from 'zustand';
import type { Plugin } from '../../domain/entities';
import type { IArgumentDefinition } from '../../domain/entities';
import { createBaseSlice, BASE_SLICE_INITIAL_STATE, type BaseSlice } from '@/shared/presentation/stores/create-base-store-slice';

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

export interface ResolvedModifier {
    plugin: Plugin;
    pluginSlug: string;
    name: string;
    icon?: string;
}

export type PluginArgument = IArgumentDefinition;

interface PluginStore extends BaseSlice {
    plugins: Plugin[];
    pluginsBySlug: Record<string, Plugin>;
    setPlugins: (items: Plugin[]) => void;
    appendPlugins: (items: Plugin[]) => void;
    addPlugin: (item: Plugin) => void;
    removePlugin: (id: string) => void;
    updatePlugin: (id: string, updates: Partial<Plugin>) => void;
    getModifiers: () => ResolvedModifier[];
    getPluginArguments: (pluginSlug: string) => PluginArgument[];
    registerPlugins: (plugins: Plugin[]) => void;
    resetPlugins: () => void;
}

const initialState = {
    plugins: [] as Plugin[],
    pluginsBySlug: {} as Record<string, Plugin>,
    ...BASE_SLICE_INITIAL_STATE
};

const buildPluginsBySlug = (plugins: Plugin[]): Record<string, Plugin> => {
    return Object.fromEntries(plugins.map((p) => [p.slug, p]));
};

const usePluginStore = create<PluginStore>((set, get) => ({
    ...initialState,
    ...createBaseSlice(set),

    setPlugins: (items) => set({
        plugins: items,
        pluginsBySlug: buildPluginsBySlug(items)
    }),

    appendPlugins: (items) => set((state) => {
        const existingIds = new Set(state.plugins.map(p => p._id));
        const uniqueNewItems = items.filter(p => !existingIds.has(p._id));
        const newPlugins = [...state.plugins, ...uniqueNewItems];
        return {
            plugins: newPlugins,
            pluginsBySlug: buildPluginsBySlug(newPlugins)
        };
    }),

    addPlugin: (item) => set((state) => {
        const newPlugins = [item, ...state.plugins];
        return {
            plugins: newPlugins,
            pluginsBySlug: buildPluginsBySlug(newPlugins)
        };
    }),

    removePlugin: (id) => set((state) => {
        const newPlugins = state.plugins.filter((p) => p._id !== id);
        return {
            plugins: newPlugins,
            pluginsBySlug: buildPluginsBySlug(newPlugins)
        };
    }),

    updatePlugin: (id, updates) => set((state) => {
        const newPlugins = state.plugins.map((p) =>
            p._id === id ? { ...p, ...updates } : p
        );
        return {
            plugins: newPlugins,
            pluginsBySlug: buildPluginsBySlug(newPlugins)
        };
    }),

    getModifiers: () => {
        return get().plugins
            .filter(plugin => plugin.modifier)
            .map(plugin => ({
                plugin,
                pluginSlug: plugin.slug,
                name: plugin.modifier?.name || plugin.slug,
                icon: plugin.modifier?.icon
            }));
    },

    getPluginArguments: (pluginSlug: string) => {
        const plugin = get().pluginsBySlug[pluginSlug];
        return (plugin?.arguments as PluginArgument[]) ?? [];
    },

    registerPlugins(incomingPlugins: Plugin[]) {
        const state = get();
        const nextPluginsBySlug = { ...state.pluginsBySlug };

        let changed = false;

        const nextPlugins = [...state.plugins];

        for (const plugin of incomingPlugins) {
            if (!plugin?.slug) continue;
            const existing = nextPluginsBySlug[plugin.slug];
            if (!existing) {
                nextPlugins.unshift(plugin);
                changed = true;
            }
            nextPluginsBySlug[plugin.slug] = plugin;
        }

        if (changed) {
            set({
                plugins: nextPlugins,
                pluginsBySlug: nextPluginsBySlug
            });
        }
    },

    resetPlugins: () => set(initialState)
}));

export default usePluginStore;
