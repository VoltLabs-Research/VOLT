import { useQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { createEntityCacheResource } from '@/shared/api/query-resources';
import queryClient from '@/shared/query/query-client';
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
    batchInvalidateQueries
} from '@/shared/query/cache-utils';
import { createMutation, createQuery, buildKeys } from '@/shared/query';
import type { QueryOptions } from '@/shared/query';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import pluginService from '../../api/services/plugin-service';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { SearchRegistryResponse } from '@volt/contracts/modules/plugin/registry';
import type { ClonePluginInput, DeletePluginInput, ExecutePipelineParams, ExportAnalysisResultsInput, ExportPluginInput, GetPluginInput, GetPluginsInput, ImportPluginInput, ListPluginTeamClustersInput, ListPluginTeamClustersResponse, SavePluginInput, SearchRegistryInput, UpdatePluginParams, UploadBinaryParams, UploadBinaryResponse } from '../../api/services/plugin-service';
import type { InstallRegistryPluginInput } from '@volt/contracts/modules/plugin/http';
import type { ExecutePipelineResponse } from '@volt/contracts/modules/plugin/plugin';

const pluginBaseKeys = buildKeys<{
    all: void;
    byId: void;
    pluginById: GetPluginInput;
}>('plugins');

const catalogKeys = buildKeys<{
    list: GetPluginsInput;
}>(['plugins', 'catalog']);

const teamClusterKeys = buildKeys<{
    list: ListPluginTeamClustersInput;
}>(['plugins', 'team-clusters']);

const registrySearchKeys = buildKeys<{
    list: SearchRegistryInput;
}>(['plugins', 'registry', 'search']);

export const PLUGIN_QUERY_KEYS = {
    all: pluginBaseKeys.all,
    byId: pluginBaseKeys.byId,
    pluginById: pluginBaseKeys.pluginById,
    catalog: catalogKeys.prefix,
    catalogList: catalogKeys.list,
    teamClustersList: teamClusterKeys.list,
    registrySearchList: registrySearchKeys.list
};

const savePlugin = async (input: SavePluginInput): Promise<Plugin> => {
    if (input._id) {
        return pluginService.update({
            _id: input._id,
            workflow: input.workflow
        });
    }
    return pluginService.create({ workflow: input.workflow });
};

const buildPluginByIdQueryOptions = (params: GetPluginInput) => {
    const accessState = useCanvasAccessStore.getState();
    const dataAccess = buildCanvasDataAccess({
        ...DEFAULT_CANVAS_ACCESS_STATE,
        mode: accessState.mode
    });
    const trajectoryId = accessState.trajectoryId ?? '';
    return {
        queryKey: withAccessMode(accessState.mode, PLUGIN_QUERY_KEYS.pluginById(params)),
        queryFn: () => dataAccess.getPluginById({
            trajectoryId,
            pluginId: params._id
        })
    };
};

export const fetchPluginById = (
    params: GetPluginInput,
    options?: { staleTime?: number }
) => {
    return queryClient.fetchQuery<Plugin>({
        ...buildPluginByIdQueryOptions(params),
        ...options
    });
};

export const usePluginByIdQuery = (
    params: GetPluginInput,
    options?: QueryOptions<Plugin>
) => {
    return useQuery<Plugin, Error, Plugin, QueryKey>({
        ...buildPluginByIdQueryOptions(params),
        ...options
    });
};

export const usePluginsCatalogQuery = createQuery<GetPluginsInput, PaginatedResponse<Plugin>>(
    (params) => PLUGIN_QUERY_KEYS.catalogList(params),
    (params) => pluginService.getAll(params)
);

export const fetchPlugins = (params: GetPluginsInput) => usePluginsCatalogQuery.fetch(params);

export const usePluginTeamClustersQuery = createQuery<ListPluginTeamClustersInput, ListPluginTeamClustersResponse>(
    (params) => PLUGIN_QUERY_KEYS.teamClustersList(params),
    (params) => pluginService.listTeamClusters(params)
);

export const useRegistrySearchQuery = createQuery<SearchRegistryInput, SearchRegistryResponse>(
    (params) => PLUGIN_QUERY_KEYS.registrySearchList(params),
    (params) => pluginService.searchRegistry(params)
);

const pluginEntityCache = createEntityCacheResource<Plugin>({
    listKey: PLUGIN_QUERY_KEYS.all,
    detailKey: (id) => PLUGIN_QUERY_KEYS.pluginById({ _id: id }),
    onUpsert: (plugin) => {
        patchPaginatedPage<Plugin>(PLUGIN_QUERY_KEYS.catalog(), (page) => {
            if (!page.data.some((currentPlugin) => currentPlugin._id === plugin._id)) {
                return page;
            }

            return upsertEntityInList(page, plugin);
        });
    },
    onRemove: (pluginId) => {
        patchPaginatedPage<Plugin>(PLUGIN_QUERY_KEYS.catalog(), (page) => removeEntityFromList(page, pluginId));
    }
});

export const syncPluginEntityCaches = (plugin: Plugin): void => {
    pluginEntityCache.upsert(plugin);
};

const invalidatePluginEntityQueries = async (): Promise<void> => {
    await batchInvalidateQueries([
        PLUGIN_QUERY_KEYS.catalog(),
        PLUGIN_QUERY_KEYS.all(),
        PLUGIN_QUERY_KEYS.byId()
    ]);
};

const managePluginEntityMutation = <TVariables, TData = Plugin>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    applySuccess: (data: TData, variables: TVariables) => void
) => createMutation<TData, TVariables>(mutationFn, async (data, variables) => {
    applySuccess(data, variables);
    await invalidatePluginEntityQueries();
});

export const useSavePluginMutation = managePluginEntityMutation<SavePluginInput>(
    savePlugin,
    syncPluginEntityCaches
);

export const useDeletePluginMutation = managePluginEntityMutation<DeletePluginInput, void>(
    pluginService.delete,
    (_data, { _id }) => pluginEntityCache.remove(_id)
);

export const useExportPluginMutation = createMutation<Blob, ExportPluginInput>(pluginService.exportPlugin);

export const useImportPluginMutation = managePluginEntityMutation<ImportPluginInput>(
    pluginService.importPlugin,
    syncPluginEntityCaches
);

export const useInstallRegistryPluginMutation = managePluginEntityMutation<InstallRegistryPluginInput>(
    pluginService.installRegistryPlugin,
    syncPluginEntityCaches
);

export const useExecutePipelineMutation = createMutation<ExecutePipelineResponse, ExecutePipelineParams>(pluginService.executePipeline);

export const useClonePluginMutation = managePluginEntityMutation<ClonePluginInput>(
    pluginService.clone,
    syncPluginEntityCaches
);

export const useUpdatePluginMutation = managePluginEntityMutation<UpdatePluginParams>(
    pluginService.update,
    syncPluginEntityCaches
);

export const useUploadBinaryMutation = createMutation<UploadBinaryResponse, UploadBinaryParams>(pluginService.uploadBinary);

export const useDeleteBinaryMutation = createMutation<void, { pluginId: string }>(pluginService.deleteBinary);

export const useExportAnalysisResultsMutation = createMutation<Blob, ExportAnalysisResultsInput>(pluginService.exportAnalysisResults);
