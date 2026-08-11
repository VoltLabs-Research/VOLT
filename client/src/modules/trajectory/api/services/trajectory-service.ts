import { createService, custom, paginated, download, serviceRoutes } from '@/app/core/http/utils/create-service';

import {
    createFolderCrudEndpoints,
    type FolderCreateParams,
    type FolderDeleteParams,
    type FolderGetParams,
    type FolderListParams,
    type FolderUpdateParams
} from '@/shared/api/folder-endpoints';
import { base64ToBlob } from '@/shared/utils/file';
import { createGetAtomsBinary } from './atoms-binary-request';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';
import type { EmptyParams } from '@voltstack/voltclient';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { VoltClient } from '@voltstack/voltclient';
import type { DashboardMetrics } from '@volt/contracts/modules/dashboard/domain';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { TrajectoryFolder } from '@volt/contracts/modules/trajectory/domain';
import type { CreateTrajectoryUploadSessionResponse } from '@volt/contracts/modules/trajectory/domain';
import type { UpdateTrajectoryInput } from '@volt/contracts/modules/trajectory/http';

export interface CreateTrajectoryInput {
    name: string;
    folderId?: string | null;
    files: Array<{
        name: string;
        size: number;
        type?: string;
    }>;
}

interface CommitTrajectoryUploadSessionInput {
    uploadSessionId: string;
    authToken?: string;
}

interface DeleteTrajectoryInput {
    trajectoryId: string;
}

interface DownloadSampleInput {
    filename: string;
}

export interface DownloadTrajectoryAnalysesInput {
    trajectoryId: string;
    filename?: string;
}

export interface DownloadTrajectoryInput {
    trajectoryId: string;
    filename?: string;
    archive?: boolean;
}

export interface GetAtomsInput {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    page?: number;
    limit?: number;
}

export type AtomColumnDType = 'f32' | 'u32' | 'u16' | 'str' | 'i32';

export interface AtomColumnView {
    name: string;
    dtype: AtomColumnDType;
    values: Float32Array | Uint32Array | Uint16Array | Int32Array | string[];
}

export interface GetAtomsResponse {
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

export interface GetPreviewInput {
    trajectoryId: string;
    frame?: number;
    quality?: 'low' | 'medium' | 'high';
}

export interface GetPreviewResponse {
    blob: Blob;
}

export interface GetTrajectoriesInput {
    page: number;
    limit: number;
    folderId?: string;
    search?: string;
}

export interface MoveTrajectoryParams {
    trajectoryId: string;
    folderId: string | null;
}

type UpdateTrajectoryParams = { trajectoryId: string } & UpdateTrajectoryInput;

interface GetTrajectoryByIdParams {
    trajectoryId: string;
}

interface CreateTrajectoryUploadSessionApiResponse {
    status: 'success';
    data: CreateTrajectoryUploadSessionResponse;
}

type RequestArgsWithTimeout = NonNullable<Parameters<VoltClient['request']>[2]> & {
    timeoutMs: number;
};

const routes = serviceRoutes('/teams', { rbac: true });

const folderEndpoints = createFolderCrudEndpoints<
    FolderListParams,
    FolderGetParams,
    FolderCreateParams,
    FolderUpdateParams,
    FolderDeleteParams,
    TrajectoryFolder
>({
    list: trajectoryRoutes.listFolders,
    get: trajectoryRoutes.getFolder,
    create: trajectoryRoutes.createFolder,
    update: trajectoryRoutes.updateFolder,
    remove: trajectoryRoutes.removeFolder
}, routes.path);

const endpoints = {
    getAll: paginated<GetTrajectoriesInput, PaginatedResponse<Trajectory>>(routes.path(trajectoryRoutes.list)),
    getById: routes.route<GetTrajectoryByIdParams, Trajectory>(trajectoryRoutes.get),
    createUploadSession: custom<CreateTrajectoryInput, CreateTrajectoryUploadSessionResponse>(async ({ getClient }, params) => {
        const response = await getClient().request<CreateTrajectoryUploadSessionApiResponse>('POST', '/trajectories/upload-sessions', {
            body: params
        });
        return response.data;
    }),
    commitUploadSession: custom<CommitTrajectoryUploadSessionInput, { trajectoryId: string }>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            timeoutMs: 0,
            ...(params.authToken ? { headers: { Authorization: `Bearer ${params.authToken}` } } : {})
        };

        return getClient().request('POST', `/trajectories/upload-sessions/${params.uploadSessionId}/commits`, requestArgs);
    }),
    cancelUploadSession: custom<CommitTrajectoryUploadSessionInput, void>(async ({ getClient }, params) => {
        const requestArgs = params.authToken
            ? { headers: { Authorization: `Bearer ${params.authToken}` } }
            : undefined;

        return getClient().request('DELETE', `/trajectories/upload-sessions/${params.uploadSessionId}`, requestArgs);
    }),
    update: routes.route<UpdateTrajectoryParams, Trajectory>(trajectoryRoutes.update),
    delete: routes.route<DeleteTrajectoryInput, void>(trajectoryRoutes.remove, {
        unwrap: 'void'
    }),
    move: routes.route<MoveTrajectoryParams, void>(trajectoryRoutes.move, {
        body: ({ folderId }) => ({ folderId })
    }),
    getPreview: routes.route<GetPreviewInput, GetPreviewResponse, string>(trajectoryRoutes.getPreview, {
        query: ({ frame, quality }) => ({
            ...(frame !== undefined ? { frame } : {}),
            ...(quality ? { quality } : {})
        }),
        map: (result) => ({ blob: base64ToBlob(result) })
    }),
    download: custom<DownloadTrajectoryInput, Blob>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            query: {
                ...(params.filename ? { name: params.filename } : {}),
                ...(params.archive !== undefined ? { archive: params.archive } : {})
            },
            responseType: 'blob',
            timeoutMs: 0
        };

        return getClient().request('GET', `/trajectories/${params.trajectoryId}/download`, requestArgs);
    }),
    downloadAnalyses: custom<DownloadTrajectoryAnalysesInput, Blob>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            query: {
                ...(params.filename ? { name: params.filename } : {})
            },
            responseType: 'blob',
            timeoutMs: 0
        };

        return getClient().request('GET', `/trajectories/${params.trajectoryId}/analyses/download`, requestArgs);
    }),
    getAtoms: custom<GetAtomsInput, GetAtomsResponse>(createGetAtomsBinary('/trajectories')),
    ...folderEndpoints,
    getMetrics: routes.route<EmptyParams, DashboardMetrics>(trajectoryRoutes.getMetrics),
    listSamples: routes.route<EmptyParams, string[]>(trajectoryRoutes.listSamples),
    downloadSample: download<DownloadSampleInput>('GET', routes.path(trajectoryRoutes.downloadSamples))
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
