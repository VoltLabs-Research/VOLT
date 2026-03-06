import { useCallback, useEffect, useRef } from 'react';
import type { Plugin } from '../../domain/entities';
import usePluginUseCases from './use-plugin-services';
import usePluginStore from '../stores/use-plugin-store';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

interface LoadAllPluginsOptions {
    limit?: number;
    force?: boolean;
}

const usePluginCatalog = () => {
    const { pluginRepository } = usePluginUseCases();
    const pluginsById = usePluginStore((state) => state.pluginsById);
    const setPlugins = usePluginStore((state) => state.setPlugins);
    const registerPlugins = usePluginStore((state) => state.registerPlugins);
    const setLoading = usePluginStore((state) => state.setLoading);
    const setError = usePluginStore((state) => state.setError);
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const loadAllPromiseRef = useRef<Promise<void> | null>(null);
    const ensurePluginPromisesRef = useRef<Map<string, Promise<Plugin | null>>>(new Map());
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            loadAllPromiseRef.current = null;
            ensurePluginPromisesRef.current.clear();
        };
    }, []);

    const loadAllPlugins = useCallback(async ({ limit = 200, force = true }: LoadAllPluginsOptions = {}): Promise<void> => {
        const currentPlugins = usePluginStore.getState().plugins;
        if (!force && currentPlugins.length > 0) return;

        if (loadAllPromiseRef.current) {
            return loadAllPromiseRef.current;
        }

        const request = (async () => {
            if (isMountedRef.current) {
                setLoading(true);
            }

            try {
                let page = 1;
                let hasMore = true;
                const allPlugins: Plugin[] = [];

                while (hasMore) {
                    const response = await pluginRepository.getAll({ page, limit });
                    allPlugins.push(...(response.data ?? []));
                    hasMore = Boolean(response.pagination?.hasMore);
                    page += 1;
                }

                if (isMountedRef.current) {
                    setPlugins(allPlugins);
                    setError(null);
                }
            } catch (error) {
                if(checkRBACError(error)) throw error;
                if (isMountedRef.current) {
                    setError(error instanceof Error ? error.message : 'Failed to load plugins');
                }
                throw error;
            } finally {
                if (isMountedRef.current) {
                    setLoading(false);
                }
                loadAllPromiseRef.current = null;
            }
        })();

        loadAllPromiseRef.current = request;
        return request;
    }, [pluginRepository, setError, setLoading, setPlugins]);

    const ensurePluginById = useCallback(async (id: string): Promise<Plugin | null> => {
        if (!id) return null;

        const fromStore = pluginsById[id];
        if (fromStore) return fromStore;

        const existingPromise = ensurePluginPromisesRef.current.get(id);
        if (existingPromise) {
            return existingPromise;
        }

        const request = (async () => {
            try {
                const response = await pluginRepository.getById({ id });
                const plugin = response ?? null;
                if (plugin && isMountedRef.current) {
                    registerPlugins([plugin]);
                    setError(null);
                }
                return plugin;
            } catch (error) {
                if(checkRBACError(error)) throw error;
                if (isMountedRef.current) {
                    setError(error instanceof Error ? error.message : `Failed to load plugin ${id}`);
                }
                throw error;
            } finally {
                ensurePluginPromisesRef.current.delete(id);
            }
        })();

        ensurePluginPromisesRef.current.set(id, request);
        return request;
    }, [pluginRepository, pluginsById, registerPlugins, setError]);

    return {
        loadAllPlugins,
        ensurePluginById,
        accessDenied,
        accessDeniedMessage
    };
};

export default usePluginCatalog;
