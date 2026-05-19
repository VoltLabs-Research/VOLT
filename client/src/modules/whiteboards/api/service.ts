import { uploadClusterObjectParts } from '@/shared/api/cluster-object-upload';
import {
    createFolderCrudEndpoints,
    type FolderCreateParams,
    type FolderDeleteParams,
    type FolderGetParams,
    type FolderListParams,
    type FolderUpdateParams
} from '@/shared/api/folder-endpoints';

import { createService, custom, del, download, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Whiteboard } from './entities/whiteboard';
import type { WhiteboardFolder } from './entities/whiteboard-folder';

export interface CreateWhiteboardParams {
    teamId: string;
    title: string;
    folderId?: string | null;
}

export interface DeleteWhiteboardParams {
    whiteboardId: string;
}

export interface ListWhiteboardsParams {
    page?: number;
    limit?: number;
    folderId?: string;
}

export interface MoveWhiteboardParams {
    whiteboardId: string;
    folderId: string | null;
}

export interface UpdateWhiteboardParams {
    whiteboardId: string;
    title?: string;
}

export interface WhiteboardIdParams {
    whiteboardId: string;
}

export interface SaveStateParams extends WhiteboardIdParams {
    state: unknown;
}

export interface UploadAssetParams extends WhiteboardIdParams {
    file: File;
}

export interface GetAssetParams extends WhiteboardIdParams {
    assetId: string;
}

export interface UploadAssetResult {
    assetId: string;
}

interface CreateAssetUploadResult extends UploadAssetResult {
    uploadUrl: string;
    expiresAt: string;
}

interface CreateAssetUploadApiResponse {
    status: 'success';
    data: CreateAssetUploadResult;
}

const folderEndpoints = createFolderCrudEndpoints<
    FolderListParams,
    FolderGetParams,
    FolderCreateParams,
    FolderUpdateParams,
    FolderDeleteParams,
    WhiteboardFolder
>();

const endpoints = {
    listWhiteboards: paginated<ListWhiteboardsParams, PaginatedResponse<Whiteboard>>('/'),
    createWhiteboard: post<CreateWhiteboardParams, Whiteboard>('/', {
        body: ({ title, folderId }) => ({ title, folderId })
    }),
    getWhiteboard: get<WhiteboardIdParams, Whiteboard>('/:whiteboardId'),
    updateWhiteboard: patch<UpdateWhiteboardParams, Whiteboard>('/:whiteboardId', {
        body: ({ title }) => ({ title })
    }),
    deleteWhiteboard: del<DeleteWhiteboardParams>('/:whiteboardId'),
    moveWhiteboard: patch<MoveWhiteboardParams, Whiteboard>('/:whiteboardId/folder', {
        body: ({ folderId }) => ({ folderId })
    }),
    getWhiteboardState: get<WhiteboardIdParams, unknown>('/:whiteboardId/state', { unwrap: 'raw' }),
    saveWhiteboardState: patch<SaveStateParams, void>('/:whiteboardId/state', {
        body: ({ state }) => state as Record<string, unknown>
    }),
    uploadWhiteboardAsset: custom<UploadAssetParams, UploadAssetResult>(async ({ getClient }, params) => {
        const response = await getClient().request<CreateAssetUploadApiResponse>(
            'POST',
            `/${params.whiteboardId}/assets`,
            {
                body: {
                    fileName: params.file.name,
                    size: params.file.size,
                    ...(params.file.type ? { type: params.file.type } : {})
                }
            }
        );
        const result = response.data;

        await uploadClusterObjectParts({
            file: params.file,
            parts: [{
                url: result.uploadUrl,
                offset: 0,
                size: params.file.size
            }],
            concurrency: 1
        });

        return { assetId: result.assetId };
    }),
    getWhiteboardAsset: download<GetAssetParams>('GET', '/:whiteboardId/assets/:assetId'),
    listWhiteboardFolders: folderEndpoints.listFolders,
    getWhiteboardFolder: folderEndpoints.getFolder,
    createWhiteboardFolder: folderEndpoints.createFolder,
    updateWhiteboardFolder: folderEndpoints.updateFolder,
    deleteWhiteboardFolder: folderEndpoints.deleteFolder
};

export default createService({
    clients: {
        default: {
            basePath: '/whiteboards',
            useRBAC: true
        }
    }
}, endpoints);
