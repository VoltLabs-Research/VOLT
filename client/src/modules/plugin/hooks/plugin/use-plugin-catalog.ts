import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useCanvasAccessStore } from '@/modules/canvas/api/access';
import { fetchPluginById, PLUGIN_QUERY_KEYS, syncPluginEntityCaches, useAllPluginsQuery } from './queries';

const usePluginCatalog = () => {
    const queryClient = useQueryClient();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const allPluginsQuery = useAllPluginsQuery({ enabled: false });

    const loadAllPlugins = useCallback(async ({ force = true }: { limit?: number; force?: boolean } = {}): Promise<void> => {
        if (useCanvasAccessStore.getState().mode === 'public') {
            return;
        }

        const currentPlugins = queryClient.getQueryData<Plugin[]>(PLUGIN_QUERY_KEYS.allList());
        if (!force && currentPlugins && currentPlugins.length > 0) return;

        try {
            await allPluginsQuery.refetch();
        } catch (error) {
            if (checkAccessDeniedError(error)) throw error;
            throw error;
        }
    }, [allPluginsQuery, queryClient, checkAccessDeniedError]);

    const ensurePluginById = useCallback(async (id: string): Promise<Plugin | null> => {
        if (!id) return null;

        const cached = queryClient.getQueryData<Plugin[]>(PLUGIN_QUERY_KEYS.allList());
        const existing = cached?.find((p) => p._id === id);
        if (existing) return existing;

        return fetchPluginById({ _id: id }, {
            staleTime: 5 * 60 * 1000
        }).then((plugin) => {
            if (plugin) {
                syncPluginEntityCaches(plugin);
            }
            return plugin;
        }).catch((error) => {
            if (checkAccessDeniedError(error)) throw error;
            throw error;
        });
    }, [queryClient, checkAccessDeniedError]);

    return {
        loadAllPlugins,
        ensurePluginById,
        accessDenied,
        accessDeniedMessage,
        isLoading: allPluginsQuery.isLoading
    };
};

export default usePluginCatalog;

export const useEnsurePluginCatalogLoaded = (enabled = true) => {
    const { loadAllPlugins } = usePluginCatalog();

    const ensureLoaded = useCallback(async () => {
        if (!enabled) {
            return;
        }

        await loadAllPlugins({ force: false });
    }, [enabled, loadAllPlugins]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        ensureLoaded().catch(() => undefined);
    }, [enabled, ensureLoaded]);

    return ensureLoaded;
};
