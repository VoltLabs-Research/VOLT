import { runRequest } from '@/shared/presentation/stores/helpers';
import { calculatePaginationState, initialListingMeta } from '@/shared/utilities/api/pagination-utils';
import type { ListingMeta } from '@/shared/utilities/api/pagination-utils';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { Plugin } from '../../domain/entities';
import { pluginRepository } from '../../infrastructure/repositories/PluginRepository';

export interface PluginState {
    plugins: Plugin[];
    pluginsBySlug: Record<string, Plugin>;
    loading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    listingMeta: ListingMeta;
}

export interface PluginActions {
    fetchPlugins: (options?: { page?: number; limit?: number; search?: string; append?: boolean }) => Promise<void>;
    fetchPlugin: (slug: string) => Promise<void>;
    resetPlugins: () => void;
}

export type PluginSlice = PluginState & PluginActions;

export const initialState: PluginState = {
    plugins: [],
    pluginsBySlug: {},
    loading: false,
    isFetchingMore: false,
    error: null,
    listingMeta: initialListingMeta
};

export const createPluginSlice: SliceCreator<PluginSlice> = (set, get) => ({
    ...initialState,

    resetPlugins: () => {
        set(initialState);
    },

    fetchPlugins: async (options = {}) => {
        const page = options.page ?? 1;
        const limit = options.limit ?? 20;
        const search = options.search ?? '';
        const append = options.append ?? false;

        const state = get();
        if (append && state.isFetchingMore) return;

        await runRequest(set, get, () => pluginRepository.getPlugins({ page, limit, search }), {
            loadingKey: append ? 'isFetchingMore' : 'loading',
            errorFallback: 'Failed to load plugins',
            onSuccess: (apiResponse) => {
                const incomingPlugins = apiResponse.data;
                const pagination = calculatePaginationState({
                    newData: incomingPlugins,
                    currentData: state.plugins,
                    page,
                    limit,
                    append,
                    totalFromApi: apiResponse.results?.total || 0,
                    previousTotal: state.listingMeta.total
                });

                const nextPluginsBySlug = { ...state.pluginsBySlug };
                for (const plugin of incomingPlugins) {
                    nextPluginsBySlug[plugin.slug] = plugin;
                }

                set({
                    plugins: pagination.data,
                    pluginsBySlug: nextPluginsBySlug,
                    listingMeta: pagination.listingMeta,
                    error: null
                });
            }
        });
    },

    fetchPlugin: async (slug: string) => {
        const state = get();
        if (state.pluginsBySlug[slug]) return;

        await runRequest(set, get, () => pluginRepository.getPlugin(slug), {
            loadingKey: 'loading',
            errorFallback: `Failed to fetch plugin ${slug}`,
            onSuccess: (plugin) => {
                const nextPluginsBySlug = { ...get().pluginsBySlug };
                nextPluginsBySlug[plugin.slug] = plugin;
                set({ pluginsBySlug: nextPluginsBySlug });
            }
        });
    }
});
