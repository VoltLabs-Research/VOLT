import { uploadClusterObjectParts } from '@/shared/api/cluster-object-upload';
import {
    createFolderCrudEndpoints,
    type FolderCreateParams,
    type FolderDeleteParams,
    type FolderGetParams,
    type FolderListParams,
    type FolderUpdateParams
} from '@/shared/api/folder-endpoints';

import { createService, custom, del, download, get, paginated, patch, post } from '@/app/core/http/utils/create-service';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { WhiteboardStoredScene } from '@/modules/whiteboards/contracts/excalidraw';
import type { Whiteboard } from '@volt/contracts/modules/whiteboards/domain';
import type { WhiteboardFolder } from '@volt/contracts/modules/whiteboards/domain';

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

interface WhiteboardIdParams {
    whiteboardId: string;
}

interface UploadAssetParams extends WhiteboardIdParams {
    file: File;
}

interface GetAssetParams extends WhiteboardIdParams {
    assetId: string;
}

interface UploadAssetResult {
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
>('/whiteboard-folders');

const endpoints = {
    listWhiteboards: paginated<ListWhiteboardsParams, PaginatedResponse<Whiteboard>>('/whiteboards'),
    createWhiteboard: post<CreateWhiteboardParams, Whiteboard>('/whiteboards', {
        body: ({ title, folderId }) => ({
            title,
            folderId
        })
    }),
    getWhiteboard: get<WhiteboardIdParams, Whiteboard>('/whiteboards/:whiteboardId'),
    updateWhiteboard: patch<UpdateWhiteboardParams, Whiteboard>('/whiteboards/:whiteboardId', {
        body: ({ title }) => ({ title })
    }),
    deleteWhiteboard: del<DeleteWhiteboardParams>('/whiteboards/:whiteboardId'),
    moveWhiteboard: patch<MoveWhiteboardParams, Whiteboard>('/whiteboards/:whiteboardId/folder', {
        body: ({ folderId }) => ({ folderId })
    }),
    getWhiteboardState: get<WhiteboardIdParams, WhiteboardStoredScene>('/whiteboards/:whiteboardId/state', { unwrap: 'raw' }),
    uploadWhiteboardAsset: custom<UploadAssetParams, UploadAssetResult>(async ({ getClient }, params) => {
        const response = await getClient().request<CreateAssetUploadApiResponse>(
            'POST',
            `/whiteboards/${params.whiteboardId}/assets`,
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
    getWhiteboardAsset: download<GetAssetParams>('GET', '/whiteboards/:whiteboardId/assets/:assetId'),
    listWhiteboardFolders: folderEndpoints.listFolders,
    getWhiteboardFolder: folderEndpoints.getFolder,
    createWhiteboardFolder: folderEndpoints.createFolder,
    updateWhiteboardFolder: folderEndpoints.updateFolder,
    deleteWhiteboardFolder: folderEndpoints.deleteFolder
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
