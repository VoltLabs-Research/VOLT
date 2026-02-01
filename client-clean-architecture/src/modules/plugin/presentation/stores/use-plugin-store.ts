import { create } from 'zustand';
import type { Plugin } from '../../domain/entities';

interface PluginState {
    plugins: Plugin[];
    pluginsBySlug: Record<string, Plugin>;
    isLoading: boolean;
    error: string | null;
};

interface PluginActions {
    setPlugins: (items: Plugin[]) => void;
    appendPlugins: (items: Plugin[]) => void;
    addPlugin: (item: Plugin) => void;
    removePlugin: (id: string) => void;
    updatePlugin: (id: string, updates: Partial<Plugin>) => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

type PluginStore = PluginState & PluginActions;

const initialState: PluginState = {
    plugins: [],
    pluginsBySlug: {},
    isLoading: false,
    error: null
};

const buildPluginsBySlug = (plugins: Plugin[]): Record<string, Plugin> => {
    return Object.fromEntries(plugins.map((p) => [p.slug, p]));
};

const usePluginStore = create<PluginStore>((set) => ({
    ...initialState,

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

    setLoading: (value) => set({ isLoading: value }),

    setError: (error) => set({ error }),

    reset: () => set(initialState)
}));

export default usePluginStore;
