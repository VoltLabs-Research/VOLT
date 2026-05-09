import { createService, paginated, get, post, patch, del, download, request } from '@/app/core/http/utilities/create-service';
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
}

interface DeleteBinaryInputDTO {
    pluginId: string;
}

interface UploadProgressEvent {
    loaded: number;
    total?: number;
}

const createUploadProgressHandler = ({ onProgress }: UploadBinaryInputDTO) => {
    let handleProgress: ((event: UploadProgressEvent) => void) | undefined;

    if (onProgress) {
        handleProgress = (event) => {
            if (event.total) {
                onProgress(event.loaded / event.total);
            }
        };
    }

    return handleProgress;
};

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
    uploadBinary: request<UploadBinaryInputDTO, UploadBinaryOutputDTO>('PATCH', '/:pluginId/binary', {
        body: ({ file, teamId }) => {
            const formData = buildFileFormData([{ name: 'file', file }]);
            formData.append('teamId', teamId);
            return formData;
        },
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: createUploadProgressHandler
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
