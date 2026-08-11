import { createService, paginated, get, patch, del, download, custom, serviceRoutes } from '@/app/core/http/utils/create-service';
import { uploadClusterObjectParts } from '@/shared/api/cluster-object-upload';
import { buildFileFormData } from '@/shared/utils/file';
import { pluginRoutes } from '@volt/contracts/modules/plugin/routes';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { PluginTeamClusterOption } from '@volt/contracts/modules/plugin/plugin';
import type { SearchRegistryResponse } from '@volt/contracts/modules/plugin/registry';
import type { IWorkflow } from '@volt/contracts/modules/plugin/workflow';
import type { ExecutePipelineResponse } from '@volt/contracts/modules/plugin/plugin';
import type {
    CreatePluginInput,
    ExecutePipelineInput,
    InstallRegistryPluginInput,
    PipelineStageKind,
    UpdatePluginInput
} from '@volt/contracts/modules/plugin/http';

export interface ClonePluginInput {
    pluginId: string;
    teamId?: string;
}

export interface DeletePluginInput {
    _id: string;
}

export interface PipelineStageInput {
    kind: PipelineStageKind;
    pluginId?: string;
    config: Record<string, unknown>;
}

export type ExecutePipelineParams = { trajectoryId: string } & ExecutePipelineInput;

export interface ExportAnalysisResultsInput {
    pluginId: string;
    analysisId: string;
}

export interface ExportPluginInput {
    _id: string;
}

export interface GetPluginInput {
    _id: string;
}

export interface GetPluginsInput {
    page: number;
    limit: number;
    search?: string;
    status?: string;
}

export interface ImportPluginInput {
    file: File;
}

export interface SearchRegistryInput {
    q?: string;
    page?: number;
    limit?: number;
}

export interface ListPluginTeamClustersInput {
    teamId: string;
    page: number;
    limit: number;
}

export type ListPluginTeamClustersResponse = PaginatedResponse<PluginTeamClusterOption>;

export interface SavePluginInput {
    _id?: string;
    workflow: IWorkflow;
}

export type UpdatePluginParams = { _id: string } & UpdatePluginInput;

export interface UploadBinaryParams{
    pluginId: string;
    teamId: string;
    file: File;
    onProgress?: (progress: number) => void;
}

export interface UploadBinaryResponse {
    objectPath: string;
    fileName: string;
    size: number;
    binaryHash: string;
}

interface DeleteBinaryInput {
    pluginId: string;
}

interface UploadBinaryTarget extends UploadBinaryResponse {
    uploadUrl: string;
}

interface NodeTypesSchemaResponse {
    nodeTypes: Record<string, string[]>;
}

const routes = serviceRoutes('/teams', { rbac: true });

const endpoints = {
    getAll: paginated<GetPluginsInput, PaginatedResponse<Plugin>>(routes.path(pluginRoutes.list)),
    getById: get<GetPluginInput, Plugin>('/plugins/:_id'),
    create: routes.route<CreatePluginInput, Plugin>(pluginRoutes.create, {
        unwrap: { field: 'plugin' }
    }),
    update: patch<UpdatePluginParams, Plugin>('/plugins/:_id'),
    clone: routes.route<ClonePluginInput, Plugin>(pluginRoutes.clone, {
        unwrap: { field: 'plugin' }
    }),
    delete: del<DeletePluginInput>('/plugins/:_id'),
    uploadBinary: custom<UploadBinaryParams, UploadBinaryResponse>(async ({ getClient }, params) => {
        const targetResponse = await getClient().request<{ data: UploadBinaryTarget }>(
            'PATCH',
            `/plugins/${params.pluginId}/binary`,
            {
                body: {
                    fileName: params.file.name,
                    size: params.file.size,
                    ...(params.file.type ? { type: params.file.type } : {})
                }
            }
        );
        const target = targetResponse.data;

        let uploadedBytes = 0;
        await uploadClusterObjectParts({
            file: params.file,
            parts: [{
                url: target.uploadUrl,
                offset: 0,
                size: params.file.size
            }],
            concurrency: 1,
            onProgress: (delta) => {
                uploadedBytes += delta;
                params.onProgress?.(Math.min(1, uploadedBytes / params.file.size));
            }
        });

        const commitResponse = await getClient().request<{ data: UploadBinaryResponse }>(
            'POST',
            `/plugins/${params.pluginId}/binary/commits`,
            {
                body: {
                    objectPath: target.objectPath,
                    fileName: target.fileName,
                    size: target.size
                }
            }
        );

        return commitResponse.data;
    }),
    deleteBinary: routes.route<DeleteBinaryInput, void>(pluginRoutes.removeBinary, { unwrap: 'void' }),
    exportPlugin: download<ExportPluginInput>('GET', '/plugins/:_id/export'),
    exportAnalysisResults: download<ExportAnalysisResultsInput>('GET', routes.path(pluginRoutes.exportListingRowsByAnalysisId)),
    importPlugin: routes.route<ImportPluginInput, Plugin>(pluginRoutes.importPlugin, {
        body: ({ file }) => buildFileFormData([{
            name: 'file',
            file
        }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    searchRegistry: routes.route<SearchRegistryInput, SearchRegistryResponse>(pluginRoutes.searchRegistry, {
        query: ({ q, page, limit }) => ({
            ...(q?.trim() ? { q: q.trim() } : {}),
            ...(page ? { page } : {}),
            ...(limit ? { limit } : {})
        })
    }),
    installRegistryPlugin: routes.route<InstallRegistryPluginInput, Plugin>(pluginRoutes.installRegistry),
    executePipeline: routes.route<ExecutePipelineParams, ExecutePipelineResponse>(pluginRoutes.executePipeline),
    listTeamClusters: paginated<ListPluginTeamClustersInput, ListPluginTeamClustersResponse>('/:teamId/clusters', {
        client: 'teamClusters'
    }),
    getNodeTypesSchema: routes.route<void, NodeTypesSchemaResponse>(pluginRoutes.getNodeTypesSchema)
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        },
        teamClusters: {
            basePath: '/teams',
            useRBAC: false
        }
    }
}, endpoints);
