import { createService, paginated, get, post, patch, del, download, request, custom } from '@/app/core/http/utilities/create-service';
import { uploadClusterObjectParts } from '@/shared/api/cluster-object-upload';
import { buildFileFormData } from '@/shared/utils/file';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { Plugin } from '../types/plugin/plugin';
import type { PluginTeamClusterOption } from '../types/plugin/team-cluster';
import type { RegistrySearchResponse } from '../types/plugin/registry';
import type { IWorkflow } from '../types/plugin/workflow';
import type { PluginStatus } from '../types/plugin/workflow-enums';

export interface ClonePluginInput {
    pluginId: string;
    teamId?: string;
}

export interface CreatePluginInput {
    workflow: IWorkflow;
}

export interface DeletePluginInput {
    _id: string;
}

export type PipelineStageKind = 'plugin' | 'slice' | 'expression';

export interface PipelineStageInput {
    kind: PipelineStageKind;
    pluginId?: string;
    config: Record<string, unknown>;
}

export interface ExecutePipelineInput {
    trajectoryId: string;
    teamClusterId?: string;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: PipelineStageInput[];
}

export interface ExecutePipelineResponse {
    analysisIds: string[];
}

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

export interface InstallRegistryPluginInput {
    name: string;
    version?: string;
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

export interface UpdatePluginInput {
    _id: string;
    workflow?: IWorkflow;
    status?: PluginStatus;
}

export interface UploadBinaryInput {
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
    expiresAt: string;
}

interface UploadBinaryTargetApiResponse {
    status: 'success';
    data: UploadBinaryTarget;
}

interface UploadBinaryCommitApiResponse {
    status: 'success';
    data: UploadBinaryResponse;
}

export interface NodeTypesSchemaResponse {
    nodeTypes: Record<string, string[]>;
}

const endpoints = {
    getAll: paginated<GetPluginsInput, PaginatedResponse<Plugin>>('/'),
    getById: get<GetPluginInput, Plugin>('/:_id'),
    create: post<CreatePluginInput, Plugin>('/', {
        unwrap: { field: 'plugin' }
    }),
    update: patch<UpdatePluginInput, Plugin>('/:_id'),
    clone: post<ClonePluginInput, Plugin>('/:pluginId/clones', {
        unwrap: { field: 'plugin' }
    }),
    delete: del<DeletePluginInput>('/:_id'),
    uploadBinary: custom<UploadBinaryInput, UploadBinaryResponse>(async ({ getClient }, params) => {
        const targetResponse = await getClient().request<UploadBinaryTargetApiResponse>(
            'PATCH',
            `/${params.pluginId}/binary`,
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

        const commitResponse = await getClient().request<UploadBinaryCommitApiResponse>(
            'POST',
            `/${params.pluginId}/binary/commit`,
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
    deleteBinary: del<DeleteBinaryInput>('/:pluginId/binary'),
    exportPlugin: download<ExportPluginInput>('GET', '/:_id/export'),
    exportAnalysisResults: download<ExportAnalysisResultsInput>('GET', '/listings/analyses/:analysisId/export'),
    importPlugin: request<ImportPluginInput, Plugin>('POST', '/import', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    searchRegistry: get<SearchRegistryInput, RegistrySearchResponse>('/registry/search', {
        query: ({ q, page, limit }) => ({
            ...(q?.trim() ? { q: q.trim() } : {}),
            ...(page ? { page } : {}),
            ...(limit ? { limit } : {})
        })
    }),
    installRegistryPlugin: post<InstallRegistryPluginInput, Plugin>('/registry/install'),
    executePipeline: post<ExecutePipelineInput, ExecutePipelineResponse>('/trajectories/:trajectoryId/pipeline-executions'),
    listTeamClusters: paginated<ListPluginTeamClustersInput, ListPluginTeamClustersResponse>('/:teamId/clusters', {
        client: 'teamClusters'
    }),
    getNodeTypesSchema: get<void, NodeTypesSchemaResponse>('/node-types/schema')
};

export default createService({
    clients: {
        default: {
            basePath: '/plugins',
            useRBAC: true
        },
        teamClusters: {
            basePath: '/teams',
            useRBAC: false
        }
    }
}, endpoints);
