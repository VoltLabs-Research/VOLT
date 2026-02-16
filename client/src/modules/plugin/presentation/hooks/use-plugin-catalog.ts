import { useCallback, useRef } from 'react';
import type { Plugin } from '../../domain/entities';
import usePluginUseCases from './use-plugin-use-cases';
import usePluginStore from '../stores/use-plugin-store';

interface LoadAllPluginsOptions {
    limit?: number;
    force?: boolean;
}

const usePluginCatalog = () => {
    const { pluginRepository } = usePluginUseCases();
    const pluginsBySlug = usePluginStore((state) => state.pluginsBySlug);
    const setPlugins = usePluginStore((state) => state.setPlugins);
    const registerPlugins = usePluginStore((state) => state.registerPlugins);
    const setLoading = usePluginStore((state) => state.setLoading);
    const setError = usePluginStore((state) => state.setError);

    const loadAllPromiseRef = useRef<Promise<void> | null>(null);
    const ensurePluginPromisesRef = useRef<Map<string, Promise<Plugin | null>>>(new Map());

    const loadAllPlugins = useCallback(async ({ limit = 200, force = true }: LoadAllPluginsOptions = {}): Promise<void> => {
        const currentPlugins = usePluginStore.getState().plugins;
        if (!force && currentPlugins.length > 0) return;

        if (loadAllPromiseRef.current) {
            return loadAllPromiseRef.current;
        }

        const request = (async () => {
            setLoading(true);
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

                setPlugins(allPlugins);
                setError(null);
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Failed to load plugins');
                throw error;
            } finally {
                setLoading(false);
                loadAllPromiseRef.current = null;
            }
        })();

        loadAllPromiseRef.current = request;
        return request;
    }, [pluginRepository, setError, setLoading, setPlugins]);

    const ensurePluginBySlug = useCallback(async (slug: string): Promise<Plugin | null> => {
        if (!slug) return null;

        const fromStore = pluginsBySlug[slug];
        if (fromStore) return fromStore;

        const existingPromise = ensurePluginPromisesRef.current.get(slug);
        if (existingPromise) {
            return existingPromise;
        }

        const request = (async () => {
            try {
                const response = await pluginRepository.getAll({
                    page: 1,
                    limit: 50,
                    search: slug
                });

                const plugin = (response.data ?? []).find((item) => item.slug === slug) ?? null;
                if (plugin) {
                    registerPlugins([plugin]);
                    setError(null);
                }
                return plugin;
            } catch (error) {
                setError(error instanceof Error ? error.message : `Failed to load plugin ${slug}`);
                throw error;
            } finally {
                ensurePluginPromisesRef.current.delete(slug);
            }
        })();

        ensurePluginPromisesRef.current.set(slug, request);
        return request;
    }, [pluginRepository, pluginsBySlug, registerPlugins, setError]);

    return {
        loadAllPlugins,
        ensurePluginBySlug
    };
};

export default usePluginCatalog;