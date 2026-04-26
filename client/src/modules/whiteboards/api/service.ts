import { buildFileFormData } from '@/shared/utils/file';
import { createFolderCrudEndpoints } from '@/shared/api/folder-endpoints';

import { createService, del, download, get, paginated, patch, post, request } from '@/app/core/http/utilities/create-service';
import type { CreateWhiteboardFolderParams } from './dtos/create-whiteboard-folder-params';
import type { CreateWhiteboardParams } from './dtos/create-whiteboard-params';
import type { DeleteWhiteboardFolderParams } from './dtos/delete-whiteboard-folder-params';
import type { DeleteWhiteboardParams } from './dtos/delete-whiteboard-params';
import type { GetWhiteboardFolderParams } from './dtos/get-whiteboard-folder-params';
import type { ListWhiteboardFoldersParams } from './dtos/list-whiteboard-folders-params';
import type { ListWhiteboardsParams } from './dtos/list-whiteboards-params';
import type { MoveWhiteboardParams } from './dtos/move-whiteboard-params';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { UpdateWhiteboardFolderParams } from './dtos/update-whiteboard-folder-params';
import type { UpdateWhiteboardParams } from './dtos/update-whiteboard-params';
import type { Whiteboard } from './entities/whiteboard';
import type { WhiteboardFolder } from './entities/whiteboard-folder';

export interface WhiteboardIdParams {
    whiteboardId: string;
};

export interface SaveStateParams extends WhiteboardIdParams {
    state: unknown;
};

export interface UploadAssetParams extends WhiteboardIdParams {
    file: File;
};

export interface GetAssetParams extends WhiteboardIdParams {
    assetId: string;
};

export interface UploadAssetResult {
    assetId: string;
};

const folderEndpoints = createFolderCrudEndpoints<
    ListWhiteboardFoldersParams,
    GetWhiteboardFolderParams,
    CreateWhiteboardFolderParams,
    UpdateWhiteboardFolderParams,
    DeleteWhiteboardFolderParams,
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
    uploadWhiteboardAsset: request<UploadAssetParams, UploadAssetResult>('POST', '/:whiteboardId/assets', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
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
