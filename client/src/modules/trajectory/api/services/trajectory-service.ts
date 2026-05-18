import { createService, custom, paginated, get, patch, del, download } from '@/app/core/http/utilities/create-service';

import {
    createFolderCrudEndpoints,
    type FolderCreateParams,
    type FolderDeleteParams,
    type FolderGetParams,
    type FolderListParams,
    type FolderUpdateParams
} from '@/shared/api/folder-endpoints';
import { base64ToBlob } from '@/shared/utils/file';
import { getAtomsBinary } from './atoms-binary-request';
import type { EmptyParams } from '@voltstack/voltclient';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { VoltClient } from '@voltstack/voltclient';
import type { DashboardMetrics } from '@/modules/dashboard/api/entities/dashboard';
import type { Trajectory } from '../entities/trajectory/trajectory';
import type { TrajectoryFolder } from '../entities/trajectory/trajectory-folder';

export interface CreateTrajectoryInputDTO {
    name: string;
    folderId?: string | null;
    files: Array<{
        name: string;
        size: number;
        type?: string;
    }>;
}

export type CreateTrajectoryOutputDTO = Trajectory;

export interface TrajectoryUploadPartDTO {
    partNumber: number;
    offset: number;
    size: number;
    url: string;
    expiresAt: string;
}

export interface TrajectoryUploadSessionFileDTO {
    index: number;
    originalName: string;
    size: number;
    contentType?: string;
    finalObjectKey: string;
    parts: TrajectoryUploadPartDTO[];
}

export interface CreateTrajectoryUploadSessionOutputDTO {
    trajectory: Trajectory;
    uploadSession: {
        id: string;
        chunkSize: number;
        expiresAt: string;
        files: TrajectoryUploadSessionFileDTO[];
    };
}

export interface CommitTrajectoryUploadSessionInputDTO {
    uploadSessionId: string;
}

export interface DeleteTrajectoryInputDTO {
    trajectoryId: string;
}

export interface DownloadSampleInputDTO {
    filename: string;
}

export interface DownloadTrajectoryAnalysesInputDTO {
    trajectoryId: string;
    filename?: string;
}

export interface DownloadTrajectoryInputDTO {
    trajectoryId: string;
    filename?: string;
    archive?: boolean;
}

export interface GetAtomsInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    page?: number;
    limit?: number;
}

export type AtomColumnDType = 'f32' | 'u32' | 'u16';

export interface AtomColumnView {
    name: string;
    dtype: AtomColumnDType;
    values: Float32Array | Uint32Array | Uint16Array;
}

export interface GetAtomsOutputDTO {
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    propertyNames: string[];
    columns: AtomColumnView[];
    getColumn: (name: string) => AtomColumnView | undefined;
}

export interface AtomData {
    id: number;
    type: string | number;
    x: number;
    y: number;
    z: number;
    [key: string]: unknown;
}

export interface GetPreviewInputDTO {
    trajectoryId: string;
    frame?: number;
    quality?: 'low' | 'medium' | 'high';
}

export interface GetPreviewOutputDTO {
    blob: Blob;
}

export interface GetTrajectoriesInputDTO {
    page: number;
    limit: number;
    folderId?: string;
    search?: string;
}

export interface MoveTrajectoryParams {
    trajectoryId: string;
    folderId: string | null;
}

export interface UpdateTrajectoryInputDTO {
    trajectoryId: string;
    name?: string;
    isPublic?: boolean;
}

interface GetTrajectoryByIdParams {
    trajectoryId: string;
}

interface CreateTrajectoryUploadSessionApiResponse {
    status: 'success';
    data: CreateTrajectoryUploadSessionOutputDTO;
}

type RequestArgsWithTimeout = NonNullable<Parameters<VoltClient['request']>[2]> & {
    timeoutMs: number;
};

const folderEndpoints = createFolderCrudEndpoints<
    FolderListParams,
    FolderGetParams,
    FolderCreateParams,
    FolderUpdateParams,
    FolderDeleteParams,
    TrajectoryFolder
>();

const endpoints = {
    getAll: paginated<GetTrajectoriesInputDTO, PaginatedResponse<Trajectory>>('/'),
    getById: get<GetTrajectoryByIdParams, Trajectory>('/:trajectoryId'),
    createUploadSession: custom<CreateTrajectoryInputDTO, CreateTrajectoryUploadSessionOutputDTO>(async ({ getClient }, params) => {
        const response = await getClient().request<CreateTrajectoryUploadSessionApiResponse>('POST', '/upload-sessions', {
            body: params
        });
        return response.data;
    }),
    commitUploadSession: custom<CommitTrajectoryUploadSessionInputDTO, { trajectoryId: string }>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            timeoutMs: 0
        };

        return getClient().request('POST', `/upload-sessions/${params.uploadSessionId}/commit`, requestArgs);
    }),
    cancelUploadSession: custom<CommitTrajectoryUploadSessionInputDTO, void>(async ({ getClient }, params) => {
        return getClient().request('DELETE', `/upload-sessions/${params.uploadSessionId}`);
    }),
    update: patch<UpdateTrajectoryInputDTO, Trajectory>('/:trajectoryId'),
    delete: del<DeleteTrajectoryInputDTO>('/:trajectoryId'),
    move: patch<{ trajectoryId: string; folderId: string | null }, void>('/:trajectoryId/folder', {
        body: ({ folderId }) => ({ folderId })
    }),
    getPreview: get<GetPreviewInputDTO, GetPreviewOutputDTO, string>('/:trajectoryId/preview', {
        query: ({ frame, quality }) => ({
            ...(frame !== undefined ? { frame } : {}),
            ...(quality ? { quality } : {})
        }),
        map: (result) => ({ blob: base64ToBlob(result) })
    }),
    // TODO: ugly fix, voltsdk need this change
    download: custom<DownloadTrajectoryInputDTO, Blob>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            query: {
                ...(params.filename ? { name: params.filename } : {}),
                ...(params.archive !== undefined ? { archive: params.archive } : {})
            },
            responseType: 'blob',
            timeoutMs: 0
        };

        return getClient().request('GET', `/${params.trajectoryId}/download`, requestArgs);
    }),
    downloadAnalyses: custom<DownloadTrajectoryAnalysesInputDTO, Blob>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            query: {
                ...(params.filename ? { name: params.filename } : {})
            },
            responseType: 'blob',
            timeoutMs: 0
        };

        return getClient().request('GET', `/${params.trajectoryId}/analyses/download`, requestArgs);
    }),
    getAtoms: custom<GetAtomsInputDTO, GetAtomsOutputDTO>(getAtomsBinary),
    ...folderEndpoints,
    getMetrics: get<EmptyParams, DashboardMetrics>('/metrics'),
    listSamples: get<EmptyParams, string[]>('/samples'),
    downloadSample: download<DownloadSampleInputDTO>('GET', '/samples/:filename')
};

export default createService({
    clients: {
        default: {
            basePath: '/trajectories',
            useRBAC: true
        }
    }
}, endpoints);
