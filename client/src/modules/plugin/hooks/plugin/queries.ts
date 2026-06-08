import {
    useQuery,
    type QueryKey,
    type UseQueryOptions
} from '@tanstack/react-query';
import { createEntityCacheResource } from '@/shared/api/query-resources';
import queryClient from '@/shared/infrastructure/query/query-client';
import {
    buildCanvasDataAccess,
    DEFAULT_CANVAS_ACCESS_STATE,
    useCanvasAccessStore,
    withAccessMode
} from '@/modules/canvas/api/access';
import {
    upsertEntityInList,
    removeEntityFromList,
    patchPaginatedPage,
    patchInfinitePages,
    batchInvalidateQueries
} from '@/shared/infrastructure/query/cache-utils';
import { createMutation, createQuery, buildKeys } from '@/shared/infrastructure/query';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import pluginService from '../../api/services/plugin-service';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import type { RegistrySearchResponse } from '@/modules/plugin/api/entities/plugin/registry';
import type {
    ClonePluginInputDTO,
    DeletePluginInputDTO,
    ExecutePluginInputDTO,
    ExecutePluginOutputDTO,
    ExportAnalysisResultsInputDTO,
    ExportPluginInputDTO,
    GetPluginInputDTO,
    GetPluginsInputDTO,
    ImportPluginInputDTO,
    InstallRegistryPluginInputDTO,
    ListPluginTeamClustersInputDTO,
    ListPluginTeamClustersOutputDTO,
    SavePluginInputDTO,
    SearchRegistryInputDTO,
    UpdatePluginInputDTO,
    UploadBinaryInputDTO,
    UploadBinaryOutputDTO
} from '../../api/services/plugin-service';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

// ---------------------------------------------------------------------------
// buildKeys — hierarchical keys with prefix support
// ---------------------------------------------------------------------------

const pluginBaseKeys = buildKeys<{
    all: void;
    byId: void;
    pluginById: GetPluginInputDTO;
}>('plugins');

const catalogKeys = buildKeys<{
    list: GetPluginsInputDTO;
}>(['plugins', 'catalog']);

const catalogInfiniteKeys = buildKeys<{
    list: { limit: number };
}>(['plugins', 'catalog', 'infinite']);

const teamClusterKeys = buildKeys<{
    list: ListPluginTeamClustersInputDTO;
}>(['plugins', 'team-clusters']);

const registrySearchKeys = buildKeys<{
    list: SearchRegistryInputDTO;
}>(['plugins', 'registry', 'search']);

// ---------------------------------------------------------------------------
// PLUGIN_QUERY_KEYS — public facade
// ---------------------------------------------------------------------------

export const PLUGIN_QUERY_KEYS = {
    root: pluginBaseKeys.prefix,
    all: pluginBaseKeys.all,
    byId: pluginBaseKeys.byId,
    allList: pluginBaseKeys.all,
    pluginById: pluginBaseKeys.pluginById,
    catalog: catalogKeys.prefix,
    catalogInfinite: catalogInfiniteKeys.prefix,
    catalogList: catalogKeys.list,
    catalogInfiniteList: catalogInfiniteKeys.list,
    teamClusters: teamClusterKeys.prefix,
    teamClustersList: teamClusterKeys.list,
    registrySearch: registrySearchKeys.prefix,
    registrySearchList: registrySearchKeys.list
};

const savePlugin = async (input: SavePluginInputDTO): Promise<Plugin> => {
    if (input._id) {
        return pluginService.update({ _id: input._id, workflow: input.workflow });
    }
    return pluginService.create({ workflow: input.workflow });
};

// usePluginByIdQuery resolves its queryKey/queryFn per-call against the
// current canvas access mode (wraps the key via withAccessMode + uses the
// mode-specific dataAccess). Kept as raw useQuery since createQuery expects
// a stable keyFn/queryFn pair and cannot capture mode from the module scope.
export const buildPluginByIdQueryOptions = (params: GetPluginInputDTO) => {
    const accessState = useCanvasAccessStore.getState();
    const dataAccess = buildCanvasDataAccess({ ...DEFAULT_CANVAS_ACCESS_STATE, mode: accessState.mode });
    const trajectoryId = accessState.trajectoryId ?? '';
    return {
        queryKey: withAccessMode(accessState.mode, PLUGIN_QUERY_KEYS.pluginById(params)),
        queryFn: () => dataAccess.getPluginById({ trajectoryId, pluginId: params._id })
    };
};

export const fetchPluginById = (
    params: GetPluginInputDTO,
    options?: { staleTime?: number }
) => {
    return queryClient.fetchQuery<Plugin>({
        ...buildPluginByIdQueryOptions(params),
        ...options
    });
};

export const usePluginByIdQuery = (
    params: GetPluginInputDTO,
    options?: QueryOptions<Plugin, Plugin>
) => {
    return useQuery<Plugin, Error, Plugin, QueryKey>({
        ...buildPluginByIdQueryOptions(params),
        ...options
    });
};

// ─── Catalog queries ─────────────────────────────────────────────────────────

const pluginsQuery = createQuery<GetPluginsInputDTO, PaginatedResponse<Plugin>>(
    (params) => PLUGIN_QUERY_KEYS.catalogList(params),
    (params) => pluginService.getAll(params)
);

export const fetchPlugins = (params: GetPluginsInputDTO) => pluginsQuery.fetch(params);

const teamClustersQuery = createQuery<ListPluginTeamClustersInputDTO, ListPluginTeamClustersOutputDTO>(
    (params) => PLUGIN_QUERY_KEYS.teamClustersList(params),
    (params) => pluginService.listTeamClusters(params)
);

export const usePluginTeamClustersQuery = (
    params: ListPluginTeamClustersInputDTO,
    options?: QueryOptions<ListPluginTeamClustersOutputDTO, ListPluginTeamClustersOutputDTO>
) => teamClustersQuery(params, options as QueryOptions<ListPluginTeamClustersOutputDTO, ListPluginTeamClustersOutputDTO> | undefined);

const registrySearchQuery = createQuery<SearchRegistryInputDTO, RegistrySearchResponse>(
    (params) => PLUGIN_QUERY_KEYS.registrySearchList(params),
    (params) => pluginService.searchRegistry(params)
);

export const useRegistrySearchQuery = (
    params: SearchRegistryInputDTO,
    options?: QueryOptions<RegistrySearchResponse, RegistrySearchResponse>
) => registrySearchQuery(params, options as QueryOptions<RegistrySearchResponse, RegistrySearchResponse> | undefined);

// ─── Cache sync helpers ──────────────────────────────────────────────────────

const pluginEntityCache = createEntityCacheResource<Plugin>({
    listKey: PLUGIN_QUERY_KEYS.allList,
    detailKey: (id) => PLUGIN_QUERY_KEYS.pluginById({ _id: id }),
    onUpsert: (plugin) => {
        patchPaginatedPage<Plugin>(PLUGIN_QUERY_KEYS.catalog(), (page) => {
            if (!page.data.some((currentPlugin) => currentPlugin._id === plugin._id)) {
                return page;
            }

            return upsertEntityInList(page, plugin);
        });

        patchInfinitePages<Plugin>(PLUGIN_QUERY_KEYS.catalogInfinite(), (page) => {
            if (!page.data.some((currentPlugin) => currentPlugin._id === plugin._id)) {
                return page;
            }

            return upsertEntityInList(page, plugin);
        });
    },
    onRemove: (pluginId) => {
        patchPaginatedPage<Plugin>(PLUGIN_QUERY_KEYS.catalog(), (page) => removeEntityFromList(page, pluginId));
        patchInfinitePages<Plugin>(PLUGIN_QUERY_KEYS.catalogInfinite(), (page) => removeEntityFromList(page, pluginId));
    }
});

export const syncPluginEntityCaches = (plugin: Plugin): void => {
    pluginEntityCache.upsert(plugin);
};

export const removePluginEntityCaches = (pluginId: string): void => {
    pluginEntityCache.remove(pluginId);
};

export const invalidatePluginCatalogQueries = async (): Promise<void> => {
    await batchInvalidateQueries([
        PLUGIN_QUERY_KEYS.catalog(),
        PLUGIN_QUERY_KEYS.all()
    ]);
};

export const invalidatePluginEntityQueries = async (): Promise<void> => {
    await invalidatePluginCatalogQueries();
    await queryClient.invalidateQueries({ queryKey: PLUGIN_QUERY_KEYS.byId() });
};

const managePluginEntityMutation = <TVariables, TData = Plugin>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    applySuccess: (data: TData, variables: TVariables) => void
) => createMutation<TData, TVariables>(mutationFn, async (data, variables) => {
    applySuccess(data, variables);
    await invalidatePluginEntityQueries();
});

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export const useSavePluginMutation = managePluginEntityMutation<SavePluginInputDTO>(
    savePlugin,
    (plugin) => syncPluginEntityCaches(plugin)
);

export const useDeletePluginMutation = managePluginEntityMutation<DeletePluginInputDTO, void>(
    pluginService.delete,
    (_data, { _id }) => removePluginEntityCaches(_id)
);

export const useExportPluginMutation = createMutation<Blob, ExportPluginInputDTO>(pluginService.exportPlugin);

export const useImportPluginMutation = managePluginEntityMutation<ImportPluginInputDTO>(
    pluginService.importPlugin,
    (plugin) => syncPluginEntityCaches(plugin)
);

export const useInstallRegistryPluginMutation = managePluginEntityMutation<InstallRegistryPluginInputDTO>(
    pluginService.installRegistryPlugin,
    (plugin) => syncPluginEntityCaches(plugin)
);

export const useExecutePluginMutation = createMutation<ExecutePluginOutputDTO, ExecutePluginInputDTO>(pluginService.execute);

export const useClonePluginMutation = managePluginEntityMutation<ClonePluginInputDTO>(
    pluginService.clone,
    (plugin) => syncPluginEntityCaches(plugin)
);

export const useUpdatePluginMutation = managePluginEntityMutation<UpdatePluginInputDTO>(
    pluginService.update,
    (plugin) => syncPluginEntityCaches(plugin)
);

export const useUploadBinaryMutation = createMutation<UploadBinaryOutputDTO, UploadBinaryInputDTO>(pluginService.uploadBinary);

export const useDeleteBinaryMutation = createMutation<void, { pluginId: string }>(pluginService.deleteBinary);

export const useExportAnalysisResultsMutation = createMutation<Blob, ExportAnalysisResultsInputDTO>(pluginService.exportAnalysisResults);
