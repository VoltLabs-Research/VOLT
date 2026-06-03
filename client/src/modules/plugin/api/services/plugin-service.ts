import { createService, paginated, get, post, patch, del, download, request, custom } from '@/app/core/http/utilities/create-service';
import { uploadClusterObjectParts } from '@/shared/api/cluster-object-upload';
import { buildFileFormData } from '@/shared/utils/file';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Plugin } from '../entities/plugin/plugin';
import type { PluginTeamClusterOption } from '../entities/plugin/team-cluster';
import type { IWorkflow } from '../entities/plugin/workflow';
import type { PluginStatus } from '../entities/plugin/workflow-enums';

export interface ClonePluginInputDTO {
    pluginId: string;
    teamId?: string;
}

export interface CreatePluginInputDTO {
    workflow: IWorkflow;
}

export interface DeletePluginInputDTO {
    _id: string;
}

export interface ExecutePluginInputDTO {
    pluginId: string;
    trajectoryId: string;
    teamClusterId: string;
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
}

export interface ExecutePluginOutputDTO {
    analysisId: string;
}

export interface ExportAnalysisResultsInputDTO {
    pluginId: string;
    analysisId: string;
}

export interface ExportPluginInputDTO {
    _id: string;
}

export interface GetPluginInputDTO {
    _id: string;
}

export interface GetPluginsInputDTO {
    page: number;
    limit: number;
    search?: string;
    status?: string;
}

export interface ImportPluginInputDTO {
    file: File;
}

export interface ListPluginTeamClustersInputDTO {
    teamId: string;
    page: number;
    limit: number;
}

export type ListPluginTeamClustersOutputDTO = PaginatedResponse<PluginTeamClusterOption>;

export interface SavePluginInputDTO {
    _id?: string;
    workflow: IWorkflow;
}

export interface UpdatePluginInputDTO {
    _id: string;
    workflow?: IWorkflow;
    status?: PluginStatus;
}

export interface UploadBinaryInputDTO {
    pluginId: string;
    teamId: string;
    file: File;
    onProgress?: (progress: number) => void;
}

export interface UploadBinaryOutputDTO {
    objectPath: string;
    fileName: string;
    size: number;
    binaryHash: string;
}

interface DeleteBinaryInputDTO {
    pluginId: string;
}

interface UploadBinaryTarget extends UploadBinaryOutputDTO {
    uploadUrl: string;
    expiresAt: string;
}

interface UploadBinaryTargetApiResponse {
    status: 'success';
    data: UploadBinaryTarget;
}

interface UploadBinaryCommitApiResponse {
    status: 'success';
    data: UploadBinaryOutputDTO;
}

const endpoints = {
    getAll: paginated<GetPluginsInputDTO, PaginatedResponse<Plugin>>('/'),
    getById: get<GetPluginInputDTO, Plugin>('/:_id'),
    create: post<CreatePluginInputDTO, Plugin>('/', {
        unwrap: { field: 'plugin' }
    }),
    update: patch<UpdatePluginInputDTO, Plugin>('/:_id'),
    clone: post<ClonePluginInputDTO, Plugin>('/:pluginId/clones', {
        unwrap: { field: 'plugin' }
    }),
    delete: del<DeletePluginInputDTO>('/:_id'),
    uploadBinary: custom<UploadBinaryInputDTO, UploadBinaryOutputDTO>(async ({ getClient }, params) => {
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
    deleteBinary: del<DeleteBinaryInputDTO>('/:pluginId/binary'),
    exportPlugin: download<ExportPluginInputDTO>('GET', '/:_id/export'),
    exportAnalysisResults: download<ExportAnalysisResultsInputDTO>('GET', '/listings/analyses/:analysisId/export'),
    importPlugin: request<ImportPluginInputDTO, Plugin>('POST', '/import', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    execute: post<ExecutePluginInputDTO, ExecutePluginOutputDTO>('/:pluginId/trajectories/:trajectoryId/executions'),
    listTeamClusters: paginated<ListPluginTeamClustersInputDTO, ListPluginTeamClustersOutputDTO>('/:teamId/clusters', {
        client: 'teamClusters'
    })
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
