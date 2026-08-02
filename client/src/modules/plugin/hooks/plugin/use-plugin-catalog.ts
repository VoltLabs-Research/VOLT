import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { PLUGIN_CATALOG_ALL_QUERY_KEY, usePluginCatalogQuery } from './catalog-query';

const usePluginCatalog = () => {
    const queryClient = useQueryClient();
    const { checkAccessDeniedError } = useAccessDenied();

    const allPluginsQuery = usePluginCatalogQuery({ enabled: false });

    const loadAllPlugins = useCallback(async (): Promise<void> => {
        const currentPlugins = queryClient.getQueryData<Plugin[]>(PLUGIN_CATALOG_ALL_QUERY_KEY);
        if (currentPlugins?.length) return;

        try {
            await allPluginsQuery.refetch();
        } catch (error) {
            checkAccessDeniedError(error);
            throw error;
        }
    }, [allPluginsQuery, queryClient, checkAccessDeniedError]);

    const ensurePluginById = useCallback(async (id: string): Promise<Plugin | null> => {
        if (!id) return null;

        const cached = queryClient.getQueryData<Plugin[]>(PLUGIN_CATALOG_ALL_QUERY_KEY);
        const existing = cached?.find((p) => p._id === id);
        if (existing) return existing;

        const { fetchPluginById, syncPluginEntityCaches } = await import('./queries');
        return fetchPluginById({ _id: id }, {
            staleTime: 5 * 60 * 1000
        }).then((plugin) => {
            syncPluginEntityCaches(plugin);
            return plugin;
        }).catch((error) => {
            checkAccessDeniedError(error);
            throw error;
        });
    }, [queryClient, checkAccessDeniedError]);

    return {
        loadAllPlugins,
        ensurePluginById
    };
};

export default usePluginCatalog;

export const useEnsurePluginCatalogLoaded = (enabled = true) => {
    const { loadAllPlugins } = usePluginCatalog();

    useEffect(() => {
        if (!enabled) {
            return;
        }

        loadAllPlugins().catch(() => undefined);
    }, [enabled, loadAllPlugins]);
};
