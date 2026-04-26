import { createService, paginated, get, post, patch, del, download, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Plugin } from '../entities/plugin';
import type { GetPluginsInputDTO } from '../dtos/plugin/get-plugins';
import type { GetPluginInputDTO } from '../dtos/plugin/get-plugin';
import type { CreatePluginInputDTO } from '../dtos/plugin/create-plugin';
import type { UpdatePluginInputDTO } from '../dtos/plugin/update-plugin';
import type { DeletePluginInputDTO } from '../dtos/plugin/delete-plugin';
import type { ClonePluginInputDTO } from '../dtos/plugin/clone-plugin';
import type { UploadBinaryInputDTO, UploadBinaryOutputDTO } from '../dtos/plugin/upload-binary';
import type { ExportPluginInputDTO } from '../dtos/plugin/export-plugin';
import type { ExportAnalysisResultsInputDTO } from '../dtos/plugin/export-analysis-results';
import type { ImportPluginInputDTO } from '../dtos/plugin/import-plugin';
import type { ExecutePluginInputDTO, ExecutePluginOutputDTO } from '../dtos/plugin/execute-plugin';
import type { ListPluginTeamClustersInputDTO, ListPluginTeamClustersOutputDTO } from '@/modules/plugin/api/dtos/plugin/list-team-clusters';

interface DeleteBinaryInputDTO {
    pluginId: string;
};

interface UploadProgressEvent {
    loaded: number;
    total?: number;
};

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
