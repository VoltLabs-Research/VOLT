import { useQuery } from '@tanstack/react-query';
import pluginService from '@/modules/plugin/api/services/plugin-service';
import { useIsWasmCanvas } from '@/modules/canvas-wasm/use-is-wasm-canvas';
import { loadWasmPlugins } from '@/modules/canvas-wasm/catalog';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { QueryOptions } from '@/shared/query/create-query';

export const PLUGIN_CATALOG_ALL_QUERY_KEY = ['plugins', 'all'] as const;
const WASM_PLUGIN_CATALOG_QUERY_KEY = ['plugins', 'wasm'] as const;

// /canvas/wasm serves its catalog from the bundled plugin manifests instead of the API.
export const usePluginCatalogQueryKey = () => (
    useIsWasmCanvas() ? WASM_PLUGIN_CATALOG_QUERY_KEY : PLUGIN_CATALOG_ALL_QUERY_KEY
);

const fetchAllPlugins = async (): Promise<Plugin[]> => {
    const PAGE_SIZE = 100;
    let page = 1;
    const allPlugins: Plugin[] = [];
    let hasMore = false;

    do {
        const response = await pluginService.getAll({
            page,
            limit: PAGE_SIZE
        });
        allPlugins.push(...response.data);
        hasMore = response.pagination.hasMore;
        page += 1;
    } while (hasMore);

    return allPlugins;
};

export const usePluginCatalogQuery = (options?: QueryOptions<Plugin[]>) => {
    const queryKey = usePluginCatalogQueryKey();
    const isWasmCatalog = queryKey === WASM_PLUGIN_CATALOG_QUERY_KEY;
    return useQuery<Plugin[], Error, Plugin[]>({
        queryKey,
        queryFn: isWasmCatalog ? loadWasmPlugins : fetchAllPlugins,
        ...(isWasmCatalog ? { staleTime: Infinity } : {}),
        ...options
    });
};
