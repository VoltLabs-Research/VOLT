import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { usePluginCatalogQuery, usePluginCatalogQueryKey } from './catalog-query';
import { useIsWasmCanvas } from '@/modules/canvas-wasm/use-is-wasm-canvas';

const usePluginCatalog = () => {
    const queryClient = useQueryClient();
    const { checkAccessDeniedError } = useAccessDenied();
    const isWasmCanvas = useIsWasmCanvas();
    const catalogQueryKey = usePluginCatalogQueryKey();

    const allPluginsQuery = usePluginCatalogQuery({ enabled: false });

    const loadAllPlugins = useCallback(async (): Promise<void> => {
        const currentPlugins = queryClient.getQueryData<Plugin[]>(catalogQueryKey);
        if (currentPlugins?.length) return;

        try {
            await allPluginsQuery.refetch();
        } catch (error) {
            checkAccessDeniedError(error);
            throw error;
        }
    }, [allPluginsQuery, catalogQueryKey, checkAccessDeniedError, queryClient]);

    const ensurePluginById = useCallback(async (id: string): Promise<Plugin | null> => {
        if (!id) return null;

        const cached = queryClient.getQueryData<Plugin[]>(catalogQueryKey);
        const existing = cached?.find((p) => p._id === id);
        if (existing) return existing;

        if (isWasmCanvas) {
            const { data } = await allPluginsQuery.refetch();
            return data?.find((plugin) => plugin._id === id) ?? null;
        }

        const { fetchPluginById, syncPluginEntityCaches } = await import('./queries');
        return fetchPluginById({ pluginId: id }, {
            staleTime: 5 * 60 * 1000
        }).then((plugin) => {
            syncPluginEntityCaches(plugin);
            return plugin;
        }).catch((error) => {
            checkAccessDeniedError(error);
            throw error;
        });
    }, [allPluginsQuery, catalogQueryKey, checkAccessDeniedError, isWasmCanvas, queryClient]);

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
