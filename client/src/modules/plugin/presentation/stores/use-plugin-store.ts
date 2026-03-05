import { create } from 'zustand';
import type { Plugin } from '../../domain/entities';
import type { IArgumentDefinition } from '../../domain/entities';
import { createBaseSlice, BASE_SLICE_INITIAL_STATE, type BaseSlice } from '@/shared/presentation/stores/create-base-store-slice';

export interface RenderableExposure {
    pluginId: string;
    analysisId: string;
    exposureId: string;
    modifierId?: string;
    name: string;
    icon?: string;
    results: string;
    canvas: boolean;
    raster: boolean;
    export?: {
        exporter?: string;
        type?: string;
        options?: Record<string, unknown>;
    };
}

export interface ResolvedModifier {
    plugin: Plugin;
    pluginId: string;
    name: string;
    icon?: string;
}

export type PluginArgument = IArgumentDefinition;

interface PluginStore extends BaseSlice {
    plugins: Plugin[];
    pluginsById: Record<string, Plugin>;
    setPlugins: (items: Plugin[]) => void;
    appendPlugins: (items: Plugin[]) => void;
    addPlugin: (item: Plugin) => void;
    removePlugin: (id: string) => void;
    updatePlugin: (id: string, updates: Partial<Plugin>) => void;
    getModifiers: () => ResolvedModifier[];
    getPluginArguments: (pluginId: string) => PluginArgument[];
    registerPlugins: (plugins: Plugin[]) => void;
    resetPlugins: () => void;
}

const initialState = {
    plugins: [] as Plugin[],
    pluginsById: {} as Record<string, Plugin>,
    ...BASE_SLICE_INITIAL_STATE
};

const buildPluginsById = (plugins: Plugin[]): Record<string, Plugin> => {
    return Object.fromEntries(plugins.map((p) => [p._id, p]));
};

const usePluginStore = create<PluginStore>((set, get) => ({
    ...initialState,
    ...createBaseSlice(set),

    setPlugins: (items) => set({
        plugins: items,
        pluginsById: buildPluginsById(items)
    }),

    appendPlugins: (items) => set((state) => {
        const existingIds = new Set(state.plugins.map(p => p._id));
        const uniqueNewItems = items.filter(p => !existingIds.has(p._id));
        const newPlugins = [...state.plugins, ...uniqueNewItems];
        return {
            plugins: newPlugins,
            pluginsById: buildPluginsById(newPlugins)
        };
    }),

    addPlugin: (item) => set((state) => {
        const newPlugins = [item, ...state.plugins];
        return {
            plugins: newPlugins,
            pluginsById: buildPluginsById(newPlugins)
        };
    }),

    removePlugin: (id) => set((state) => {
        const newPlugins = state.plugins.filter((p) => p._id !== id);
        return {
            plugins: newPlugins,
            pluginsById: buildPluginsById(newPlugins)
        };
    }),

    updatePlugin: (id, updates) => set((state) => {
        const newPlugins = state.plugins.map((p) =>
            p._id === id ? { ...p, ...updates } : p
        );
        return {
            plugins: newPlugins,
            pluginsById: buildPluginsById(newPlugins)
        };
    }),

    getModifiers: () => {
        return get().plugins
            .filter(plugin => plugin.modifier)
            .map(plugin => ({
                plugin,
                pluginId: plugin._id,
                name: plugin.modifier?.name || plugin._id,
                icon: plugin.modifier?.icon
            }));
    },

    getPluginArguments: (pluginId: string) => {
        const plugin = get().pluginsById[pluginId];
        return (plugin?.arguments as PluginArgument[]) ?? [];
    },

    registerPlugins(incomingPlugins: Plugin[]) {
        const state = get();
        const nextPluginsById = { ...state.pluginsById };

        let changed = false;

        const nextPlugins = [...state.plugins];

        for (const plugin of incomingPlugins) {
            if (!plugin?._id) continue;
            const existing = nextPluginsById[plugin._id];
            if (!existing) {
                nextPlugins.unshift(plugin);
                changed = true;
            }
            nextPluginsById[plugin._id] = plugin;
        }

        if (changed) {
            set({
                plugins: nextPlugins,
                pluginsById: nextPluginsById
            });
        }
    },

    resetPlugins: () => set(initialState)
}));

export default usePluginStore;
