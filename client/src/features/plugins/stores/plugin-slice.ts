import { create } from 'zustand';
import pluginApi from '@/features/plugins/api/plugin';
import { useAnalysisConfigStore } from '@/features/analysis/stores';
import type { IPluginRecord, IExposureComputed, IArgumentDefinition } from '@/features/plugins/types';
import { calculatePaginationState, initialListingMeta } from '@/utilities/api/pagination-utils';
import { runRequest } from '@/stores/helpers';

/**
 * RenderableExposure - Format used by canvas/scene components
 * This is derived from IExposureComputed (backend-computed) + context data
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
 * Derived from plugin.modifier (backend-computed)
 */
export interface ResolvedModifier {
    plugin: IPluginRecord;
    pluginSlug: string;
    name: string;
    icon?: string;
}

/**
 * PluginArgument - Re-export of IArgumentDefinition for convenience
 */
export type PluginArgument = IArgumentDefinition;

export interface PluginState {
    plugins: IPluginRecord[];
    pluginsBySlug: Record<string, IPluginRecord>;
    modifiers: ResolvedModifier[];
    loading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    listingMeta: { page: number; limit: number; total: number; hasMore: boolean };

    fetchPlugins: (opts?: {
        page?: number;
        limit?: number;
        search?: string;
        append?: boolean;
        force?: boolean;
    }) => Promise<void>;

    getModifiers: () => ResolvedModifier[];
    getPluginArguments: (pluginSlug: string) => PluginArgument[];

    getRenderableExposures: (
        trajectoryId: string,
        analysisId?: string,
        context?: 'canvas' | 'raster',
        pluginSlug?: string
    ) => Promise<RenderableExposure[]>;

    getAllExposures: (
        trajectoryId: string,
        analysisId?: string,
        pluginSlug?: string
    ) => Promise<RenderableExposure[]>;

    fetchPlugin: (slug: string) => Promise<void>;
    resetPlugins: () => void;
}

const PLUGINS_TTL_MS = 60_000;

let lastPluginsFetchAtMs = 0;

/**
 * Convert backend IExposureComputed to frontend RenderableExposure
 */
function toRenderableExposure(
    plugin: IPluginRecord,
    exposure: IExposureComputed,
    analysisId: string
): RenderableExposure {
    return {
        pluginId: plugin._id,
        pluginSlug: plugin.slug,
        analysisId,
        exposureId: exposure._id,
        modifierId: plugin.slug,
        name: exposure.name,
        icon: exposure.icon,
        results: exposure.results,
        canvas: exposure.canvas,
        raster: exposure.raster,
        perAtomProperties: exposure.perAtomProperties,
        export: exposure.export || undefined
    };
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
    plugins: [],
    pluginsBySlug: {},
    modifiers: [],
    loading: false,
    isFetchingMore: false,
    error: null,
    listingMeta: initialListingMeta,

    resetPlugins: () => {
        set({
            plugins: [],
            pluginsBySlug: {},
            modifiers: [],
            listingMeta: initialListingMeta,
            loading: false,
            error: null
        });
        lastPluginsFetchAtMs = 0;
    },

    async fetchPlugins(options = {}) {
        const {
            page = 1,
            limit = 20,
            search = '',
            append = false,
            force = false
        } = options;

        const state = get();
        const nowMs = Date.now();

        const canUseCache =
            !force &&
            !append &&
            page === 1 &&
            state.plugins.length > 0 &&
            nowMs - lastPluginsFetchAtMs < PLUGINS_TTL_MS;

        if (canUseCache) {
            return;
        }

        if (append && state.isFetchingMore) {
            return;
        }

        if (!append && state.loading) {
            return;
        }

        const loadingKey = append ? 'isFetchingMore' : 'loading';

        const request = () => pluginApi.getPlugins({ page, limit, search });

        await runRequest(set, get, request, {
            loadingKey,
            errorFallback: 'Failed to load plugins',
            onSuccess: (apiResponse) => {
                const incomingPlugins = apiResponse.data;
                const totalFromApi = apiResponse.results?.total;

                const pagination = calculatePaginationState({
                    newData: incomingPlugins,
                    currentData: state.plugins,
                    page,
                    limit,
                    append,
                    totalFromApi,
                    previousTotal: state.listingMeta.total
                });

                const nextPluginsBySlug = { ...state.pluginsBySlug };
                for (const plugin of incomingPlugins) {
                    nextPluginsBySlug[plugin.slug] = plugin;
                }

                // Use backend-computed modifier field
                const nextModifiers = resolveModifiersFromPlugins(pagination.data);

                set({
                    plugins: pagination.data,
                    pluginsBySlug: nextPluginsBySlug,
                    modifiers: nextModifiers,
                    listingMeta: pagination.listingMeta,
                    error: null
                });

                if (!append && page === 1) {
                    lastPluginsFetchAtMs = nowMs;
                }
            }
        });
    },

    async fetchPlugin(slug: string) {
        const state = get();
        if (state.pluginsBySlug[slug]) return;

        set({ loading: true });
        try {
            const plugin = await pluginApi.getPlugin(slug);
            const nextPluginsBySlug = { ...get().pluginsBySlug };
            nextPluginsBySlug[plugin.slug] = plugin;

            // Update modifiers if this plugin isn't there
            const modifiers = get().modifiers;
            const existingModifier = modifiers.find(m => m.pluginSlug === plugin.slug);
            let nextModifiers = modifiers;

            if (!existingModifier && plugin.modifier) {
                nextModifiers = [...modifiers, {
                    plugin,
                    pluginSlug: plugin.slug,
                    name: plugin.modifier.name,
                    icon: plugin.modifier.icon
                }];
            }

            set({
                pluginsBySlug: nextPluginsBySlug,
                modifiers: nextModifiers,
                loading: false
            });
        } catch (error) {
            console.error(`Failed to fetch plugin ${slug}:`, error);
            set({ loading: false });
        }
    },

    getModifiers() {
        return get().modifiers;
    },

    /**
     * Get plugin arguments using backend-computed arguments field
     */
    getPluginArguments(pluginSlug) {
        const plugin = get().pluginsBySlug[pluginSlug];
        return (plugin?.arguments ?? []) as PluginArgument[];
    },

    /**
     * Get exposures filtered by context (canvas/raster)
     * Uses backend-computed exposures field
     */
    async getRenderableExposures(trajectoryId, analysisId, context = 'canvas', pluginSlug) {
        const { analysisConfig } = useAnalysisConfigStore.getState();

        const resolvedAnalysisId = analysisId ?? analysisConfig?._id;
        const resolvedPluginSlug = pluginSlug ?? analysisConfig?.plugin;

        if (!resolvedAnalysisId || !resolvedPluginSlug) {
            return [];
        }

        await get().fetchPlugins({ force: true });

        const plugin = get().pluginsBySlug[resolvedPluginSlug];
        if (!plugin?.exposures) {
            return [];
        }

        // Filter by context (canvas/raster support) and convert to RenderableExposure
        return plugin.exposures
            .filter(exposure => {
                const matchesContext = context === 'canvas' ? exposure.canvas : exposure.raster;
                if (!matchesContext) return false;

                // Must have valid export or visualizer support
                const exportsGlb = exposure.export?.type === 'glb';
                const exportsChart = exposure.export?.type === 'chart-png';
                return exportsGlb || exportsChart || exposure.canvas || exposure.raster;
            })
            .map(exposure => toRenderableExposure(plugin, exposure, resolvedAnalysisId));
    },

    /**
     * Get all exposures without filtering by context
     * Used by Plugin Results Viewer
     */
    async getAllExposures(trajectoryId: string, analysisId?: string, pluginSlug?: string): Promise<RenderableExposure[]> {
        const { analysisConfig } = useAnalysisConfigStore.getState();

        const resolvedAnalysisId = analysisId ?? analysisConfig?._id;
        const resolvedPluginSlug = pluginSlug ?? analysisConfig?.plugin;

        if (!resolvedAnalysisId || !resolvedPluginSlug) {
            return [];
        }

        await get().fetchPlugins({ force: true });

        const plugin = get().pluginsBySlug[resolvedPluginSlug];
        if (!plugin?.exposures) {
            return [];
        }

        // Return all exposures without context filtering
        return plugin.exposures.map(exposure =>
            toRenderableExposure(plugin, exposure, resolvedAnalysisId)
        );
    }
}));
