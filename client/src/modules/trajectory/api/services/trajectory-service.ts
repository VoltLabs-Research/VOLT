import { createService, custom, paginated, get, patch, del, download } from '@/app/core/http/utilities/create-service';

import { createFolderCrudEndpoints } from '@/shared/api/folder-endpoints';
import { base64ToBlob } from '@/shared/utils/file';
import { decodeAtomsBinary } from '@/modules/trajectory/utilities/decode-atoms-binary';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { VoltClient } from '@voltstack/voltclient';
import type { DashboardMetrics } from '@/modules/dashboard/api/entities/dashboard';
import type { Trajectory } from '../entities/trajectory';
import type { TrajectoryFolder } from '../entities/trajectory/trajectory-folder';
import type {
    CreateTrajectoryInputDTO,
    CreateTrajectoryOutputDTO,
    DeleteTrajectoryInputDTO,
    DownloadSampleInputDTO,
    DownloadTrajectoryAnalysesInputDTO,
    DownloadTrajectoryInputDTO,
    GetAtomsInputDTO,
    GetAtomsOutputDTO,
    GetPreviewInputDTO,
    GetPreviewOutputDTO,
    GetTrajectoriesInputDTO,
    UpdateTrajectoryInputDTO
} from '../dtos/trajectory';
import type { CreateTrajectoryFolderParams } from '../dtos/trajectory/create-trajectory-folder';
import type { DeleteTrajectoryFolderParams } from '../dtos/trajectory/delete-trajectory-folder';
import type { GetTrajectoryFolderParams } from '../dtos/trajectory/get-trajectory-folder';
import type { ListTrajectoryFoldersParams } from '../dtos/trajectory/list-trajectory-folders';
import type { UpdateTrajectoryFolderParams } from '../dtos/trajectory/update-trajectory-folder';

interface GetTrajectoryByIdParams {
    trajectoryId: string;
};

interface CreateTrajectoryApiResponse {
    status: 'success';
    data: Trajectory;
};

const MULTIPART_FORM_HEADERS: Record<string, string> = {
    'Content-Type': 'multipart/form-data'
};

type RequestArgsWithTimeout = NonNullable<Parameters<VoltClient['request']>[2]> & {
    timeoutMs: number;
};

const folderEndpoints = createFolderCrudEndpoints<
    ListTrajectoryFoldersParams,
    GetTrajectoryFolderParams,
    CreateTrajectoryFolderParams,
    UpdateTrajectoryFolderParams,
    DeleteTrajectoryFolderParams,
    TrajectoryFolder
>();

const endpoints = {
    getAll: paginated<GetTrajectoriesInputDTO, PaginatedResponse<Trajectory>>('/'),
    getById: get<GetTrajectoryByIdParams, Trajectory>('/:trajectoryId'),
    create: custom<CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            body: params.formData,
            headers: MULTIPART_FORM_HEADERS,
            onUploadProgress: params.onProgress
                ? (e) => {
                    if (e.total) {
                        params.onProgress?.(e.loaded / e.total);
                    }
                }
                : undefined,
            timeoutMs: 0
        };

        const response = await getClient().request<CreateTrajectoryApiResponse>('POST', '/', requestArgs);
        return response.data;
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
    getAtoms: custom<GetAtomsInputDTO, GetAtomsOutputDTO>(async ({ getClient }, params) => {
        // Why: F2.S4 — the atoms endpoint now returns the columnar binary body
        // directly (SoA, no JSON parse). The SDK exposes `blob` as the binary
        // transport; we convert to `ArrayBuffer` and hand it to the shared
        // zero-copy decoder.
        const blob = await getClient().request<Blob>(
            'GET',
            `/${params.trajectoryId}/frame/${params.timestep}/atoms`,
            {
                query: {
                    fmt: 'bin',
                    ...(params.page !== undefined ? { page: params.page } : {}),
                    ...(params.limit !== undefined ? { limit: params.limit } : {}),
                    ...(params.analysisId ? { analysisId: params.analysisId } : {})
                },
                responseType: 'blob'
            }
        );

        const buffer = await blob.arrayBuffer();
        return decodeAtomsBinary(buffer);
    }),
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
