import { create } from 'zustand';
import { container } from 'tsyringe';
import type { Plugin } from '../../domain/entities';
import type { IExposureComputed, IArgumentDefinition } from '../../domain/entities';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

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

interface PluginState {
    plugins: Plugin[];
    pluginsBySlug: Record<string, Plugin>;
    loading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    listingMeta: { page: number; limit: number; total: number; hasMore: boolean };
}

interface PluginActions {
    setPlugins: (items: Plugin[]) => void;
    appendPlugins: (items: Plugin[]) => void;
    addPlugin: (item: Plugin) => void;
    removePlugin: (id: string) => void;
    updatePlugin: (id: string, updates: Partial<Plugin>) => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;

    fetchPlugins: (opts?: {
        page?: number;
        limit?: number;
        search?: string;
        append?: boolean;
        force?: boolean;
    }) => Promise<void>;
    fetchAllPlugins: (opts?: { limit?: number; force?: boolean }) => Promise<void>;
    fetchPlugin: (slug: string) => Promise<void>;
    getModifiers: () => ResolvedModifier[];
    getPluginArguments: (pluginSlug: string) => PluginArgument[];
    registerPlugins: (plugins: Plugin[]) => void;
    resetPlugins: () => void;
}

type PluginStore = PluginState & PluginActions;

const initialState: PluginState = {
    plugins: [],
    pluginsBySlug: {},
    loading: false,
    isFetchingMore: false,
    error: null,
    listingMeta: { page: 1, limit: 20, total: 0, hasMore: false }
};

const buildPluginsBySlug = (plugins: Plugin[]): Record<string, Plugin> => {
    return Object.fromEntries(plugins.map((p) => [p.slug, p]));
};

const usePluginStore = create<PluginStore>((set, get) => ({
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

    setLoading: (value) => set({ loading: value }),

    setError: (error) => set({ error }),

    async fetchPlugins(options = {}) {
        const {
            page = 1,
            limit = 20,
            search = '',
            append = false,
            force = false
        } = options;

        const state = get();
        if (append && state.isFetchingMore) return;
        if (!append && state.loading) return;

        if (!force && !append && page === 1 && state.plugins.length > 0) {
            return;
        }

        const loadingKey = append ? 'isFetchingMore' : 'loading';
        set({ [loadingKey]: true } as any);

        try {
            const repository = container.resolve<IPluginRepository>(PLUGIN_TOKENS.PluginRepository);
            const response = await repository.getAll({ page, limit, search });
            const data = (response as PaginatedResponse<Plugin>).data ?? [];
            const pagination = (response as PaginatedResponse<Plugin>).pagination;

            const nextPlugins = append ? [...state.plugins, ...data] : data;
            const pluginsBySlug = buildPluginsBySlug(nextPlugins);

            set({
                plugins: nextPlugins,
                pluginsBySlug,
                listingMeta: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total: pagination.total,
                    hasMore: pagination.hasMore
                },
                error: null
            });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to load plugins' });
        } finally {
            set({ [loadingKey]: false } as any);
        }
    },

    async fetchPlugin(slug: string) {
        const state = get();
        if (state.pluginsBySlug[slug]) return;

        set({ loading: true });
        try {
            const repository = container.resolve<IPluginRepository>(PLUGIN_TOKENS.PluginRepository);
            const plugin = await repository.getById({ id: slug });
            const nextPluginsBySlug = { ...get().pluginsBySlug, [plugin.slug]: plugin };
            const nextPlugins = [plugin, ...get().plugins.filter(p => p.slug !== plugin.slug)];
            set({
                plugins: nextPlugins,
                pluginsBySlug: nextPluginsBySlug,
                loading: false
            });
        } catch (error) {
            console.error(`Failed to fetch plugin ${slug}:`, error);
            set({ loading: false });
        }
    },

    async fetchAllPlugins({ limit = 200, force = true } = {}) {
        await get().fetchPlugins({ page: 1, limit, force });
        let meta = get().listingMeta;
        let page = meta.page;

        while (meta.hasMore) {
            page += 1;
            await get().fetchPlugins({ page, limit, append: true, force });
            meta = get().listingMeta;
        }
    },

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

    resetPlugins: () => set(initialState),
    reset: () => set(initialState)
}));

export default usePluginStore;
