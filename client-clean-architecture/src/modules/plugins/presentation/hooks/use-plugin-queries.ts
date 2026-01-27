import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pluginRepository } from '@/modules/plugins/infrastructure/repositories/PluginRepository';
import type { IPluginRecord, PluginStatus } from '@/modules/plugins/domain/types';
import type { PaginatedResponse } from '@/shared/types/api';
import { useAnalysisStore } from '@/modules/analysis/presentation/stores';

export const pluginQueryKeys = {
    all: ['plugins'] as const,
    lists: () => [...pluginQueryKeys.all, 'list'] as const,
    list: (params: any) => [...pluginQueryKeys.lists(), params] as const,
    details: () => [...pluginQueryKeys.all, 'detail'] as const,
    detail: (slug: string) => [...pluginQueryKeys.details(), slug] as const,
    schemas: () => [...pluginQueryKeys.all, 'schemas'] as const,
    listings: () => [...pluginQueryKeys.all, 'listings'] as const,
    listing: (pluginSlug: string, listingSlug: string, params: any) =>
        [...pluginQueryKeys.listings(), pluginSlug, listingSlug, params] as const
};

export const usePlugins = (params: { search?: string; limit?: number; status?: PluginStatus } = {}) => {
    const limit = params.limit ?? 20;
    const search = params.search ?? '';
    const status = params.status;

    const query = useInfiniteQuery<PaginatedResponse<IPluginRecord>>({
        queryKey: pluginQueryKeys.list({ search, limit, status }),
        queryFn: ({ pageParam }) =>
            pluginRepository.getPlugins({ page: pageParam as number, limit, search, status }) as any,
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            const current = lastPage.page?.current ?? 1;
            const total = lastPage.page?.total ?? 0;
            return current < total ? current + 1 : undefined;
        },
    });

    const pages = query.data?.pages ?? [];
    const plugins = pages.flatMap((page) => page.data);
    const lastPage = pages[pages.length - 1];
    const total = lastPage?.results?.total ?? plugins.length;
    const currentPage = (lastPage?.page?.current ?? pages.length) || 1;

    const listingMeta = {
        page: currentPage,
        limit,
        total,
        hasMore: Boolean(query.hasNextPage)
    };

    return {
        ...query,
        plugins,
        listingMeta
    };
};

export const usePlugin = (slug: string, enabled = true) => {
    return useQuery({
        queryKey: pluginQueryKeys.detail(slug),
        queryFn: () => pluginRepository.getPlugin(slug) as Promise<IPluginRecord>,
        enabled: Boolean(slug) && enabled,
    });
};

export const useUpdatePlugin = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ slug, data }: { slug: string; data: any }) =>
            pluginRepository.updatePlugin(slug, data) as Promise<IPluginRecord>,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: pluginQueryKeys.all });
            queryClient.invalidateQueries({ queryKey: pluginQueryKeys.detail(variables.slug) });
        }
    });
};

export const useDeletePlugin = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (slug: string) => pluginRepository.deletePlugin(slug),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: pluginQueryKeys.all });
        }
    });
};

export const usePublishPlugin = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (idOrSlug: string) => pluginRepository.publishPlugin(idOrSlug) as Promise<IPluginRecord>,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: pluginQueryKeys.all });
        }
    });
};

export const useExecutePlugin = () => {
    return useMutation({
        mutationFn: (params: { slug: string; trajectoryId: string; config: any; selectedFrameOnly?: boolean; timestep?: number }) =>
            pluginRepository.executePlugin(
                params.slug,
                params.trajectoryId,
                {
                    config: params.config,
                    selectedFrameOnly: params.selectedFrameOnly,
                    timestep: params.timestep
                }
            )
    });
};

export const useNodeSchemas = (enabled = true) => {
    return useQuery({
        queryKey: pluginQueryKeys.schemas(),
        queryFn: () => pluginRepository.getNodeSchemas(),
        staleTime: Infinity,
        enabled
    });
};

/**
 * Paginated query for a specific plugin listing/exposure
 */
export const usePluginListing = (params: {
    pluginSlug: string;
    listingSlug: string;
    trajectoryId?: string;
    teamId?: string;
    limit?: number;
}) => {
    const limit = params.limit ?? 50;

    const query = useInfiniteQuery({
        queryKey: pluginQueryKeys.listing(params.pluginSlug, params.listingSlug, {
            trajectoryId: params.trajectoryId,
            teamId: params.teamId,
            limit
        }),
        queryFn: ({ pageParam }) =>
            pluginRepository.getListing(
                params.pluginSlug,
                params.listingSlug,
                params.trajectoryId,
                {
                    limit,
                    teamId: params.teamId,
                    cursor: pageParam as string
                }
            ),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
        enabled: Boolean(params.pluginSlug && params.listingSlug && (params.trajectoryId || params.teamId))
    });

    const pages = query.data?.pages ?? [];
    const rows = pages.flatMap((page) => page.rows ?? []);
    const lastPage = pages[pages.length - 1];

    const listingMeta = {
        page: pages.length,
        limit,
        hasMore: Boolean(query.hasNextPage),
        nextCursor: lastPage?.nextCursor ?? null
    };

    return {
        ...query,
        rows,
        listingMeta
    };
};

/**
 * Derived hook to get exposures for a plugin context
 */
export const usePluginExposures = (params: {
    analysisId?: string;
    pluginSlug?: string;
    context?: 'canvas' | 'raster';
}) => {
    const { analysisConfig } = useAnalysisStore();
    const resolvedAnalysisId = params.analysisId ?? analysisConfig?._id;
    const resolvedPluginSlug = params.pluginSlug ?? (analysisConfig as any)?.plugin ?? (analysisConfig as any)?.modifier;

    const { data: plugin, ...query } = usePlugin(resolvedPluginSlug as string, Boolean(resolvedPluginSlug));

    const exposures = (plugin?.exposures ?? [])
        .filter(exposure => {
            if (!params.context) return true;
            return params.context === 'canvas' ? exposure.canvas : exposure.raster;
        })
        .map(exposure => ({
            pluginId: plugin?._id,
            pluginSlug: plugin?.slug,
            analysisId: resolvedAnalysisId,
            exposureId: exposure._id,
            modifierId: plugin?.slug,
            name: exposure.name,
            icon: exposure.icon,
            results: exposure.results,
            canvas: exposure.canvas,
            raster: exposure.raster,
            perAtomProperties: exposure.perAtomProperties,
            export: exposure.export
        }));

    return {
        ...query,
        exposures,
        plugin
    };
};
