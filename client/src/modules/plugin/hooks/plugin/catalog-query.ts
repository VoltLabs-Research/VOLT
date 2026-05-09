import { useQuery } from '@tanstack/react-query';
import pluginService from '@/modules/plugin/api/services/plugin';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import type { UseQueryOptions } from '@tanstack/react-query';

export const PLUGIN_CATALOG_ALL_QUERY_KEY = ['plugins', 'all'] as const;

export const fetchAllPlugins = async (): Promise<Plugin[]> => {
    const PAGE_SIZE = 100;
    let page = 1;
    const allPlugins: Plugin[] = [];
    let hasMore = false;

    do {
        const response = await pluginService.getAll({ page, limit: PAGE_SIZE });
        allPlugins.push(...response.data);
        hasMore = response.pagination.hasMore;
        page += 1;
    } while (hasMore);

    return allPlugins;
};

type PluginCatalogQueryOptions = Omit<UseQueryOptions<Plugin[], Error, Plugin[]>, 'queryKey' | 'queryFn'>;

export const usePluginCatalogQuery = (options?: PluginCatalogQueryOptions) => {
    return useQuery<Plugin[], Error, Plugin[]>({
        queryKey: PLUGIN_CATALOG_ALL_QUERY_KEY,
        queryFn: fetchAllPlugins,
        ...options
    });
};
