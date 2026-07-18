import { get, post, patch, del } from '../../shared/routing';
import type {
    CreateWhiteboardInput,
    UpdateWhiteboardInput,
    MoveWhiteboardInput,
    CreateWhiteboardFolderInput,
    UpdateWhiteboardFolderInput,
    UploadWhiteboardAssetInput,
    SaveWhiteboardStateInput
} from './http';
import type {
    WhiteboardListItem,
    CreateWhiteboardResponse,
    GetWhiteboardResponse,
    UpdateWhiteboardResponse,
    UploadWhiteboardAssetResponse,
    WhiteboardFolder
} from './domain';

export const whiteboardRoutes = {
    create: post<CreateWhiteboardInput, CreateWhiteboardResponse>('/api/whiteboards/:teamId'),
    list: get<WhiteboardListItem>('/api/whiteboards/:teamId'),

    listFolders: get<WhiteboardFolder>('/api/whiteboards/:teamId/folders'),
    getFolder: get<WhiteboardFolder>('/api/whiteboards/:teamId/folders/:folderId'),
    createFolder: post<CreateWhiteboardFolderInput, WhiteboardFolder>('/api/whiteboards/:teamId/folders'),
    updateFolder: patch<UpdateWhiteboardFolderInput, WhiteboardFolder>('/api/whiteboards/:teamId/folders/:folderId'),
    removeFolder: del('/api/whiteboards/:teamId/folders/:folderId'),

    get: get<GetWhiteboardResponse>('/api/whiteboards/:teamId/:whiteboardId'),
    update: patch<UpdateWhiteboardInput, UpdateWhiteboardResponse>('/api/whiteboards/:teamId/:whiteboardId'),
    remove: del('/api/whiteboards/:teamId/:whiteboardId'),
    move: patch<MoveWhiteboardInput, null>('/api/whiteboards/:teamId/:whiteboardId/folder'),

    getState: get<unknown>('/api/whiteboards/:teamId/:whiteboardId/state'),
    saveState: patch<SaveWhiteboardStateInput, null>('/api/whiteboards/:teamId/:whiteboardId/state'),

    uploadAsset: post<UploadWhiteboardAssetInput, UploadWhiteboardAssetResponse>('/api/whiteboards/:teamId/:whiteboardId/assets'),
    getAsset: get<unknown>('/api/whiteboards/:teamId/:whiteboardId/assets/:assetId')
} as const;
