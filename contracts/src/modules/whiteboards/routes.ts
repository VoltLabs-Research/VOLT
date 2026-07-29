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
    Whiteboard,
    CreateWhiteboardResponse,
    UpdateWhiteboardResponse,
    UploadWhiteboardAssetResponse,
    WhiteboardFolder
} from './domain';

export const whiteboardRoutes = {
    create: post<CreateWhiteboardInput, CreateWhiteboardResponse>('/api/teams/:teamId/whiteboards'),
    list: get<Whiteboard>('/api/teams/:teamId/whiteboards'),

    listFolders: get<WhiteboardFolder>('/api/teams/:teamId/whiteboard-folders'),
    getFolder: get<WhiteboardFolder>('/api/teams/:teamId/whiteboard-folders/:folderId'),
    createFolder: post<CreateWhiteboardFolderInput, WhiteboardFolder>('/api/teams/:teamId/whiteboard-folders'),
    updateFolder: patch<UpdateWhiteboardFolderInput, WhiteboardFolder>('/api/teams/:teamId/whiteboard-folders/:folderId'),
    removeFolder: del('/api/teams/:teamId/whiteboard-folders/:folderId'),

    get: get<Whiteboard>('/api/teams/:teamId/whiteboards/:whiteboardId'),
    update: patch<UpdateWhiteboardInput, UpdateWhiteboardResponse>('/api/teams/:teamId/whiteboards/:whiteboardId'),
    remove: del('/api/teams/:teamId/whiteboards/:whiteboardId'),
    move: patch<MoveWhiteboardInput, null>('/api/teams/:teamId/whiteboards/:whiteboardId/folder'),

    getState: get<unknown>('/api/teams/:teamId/whiteboards/:whiteboardId/state'),
    saveState: patch<SaveWhiteboardStateInput, null>('/api/teams/:teamId/whiteboards/:whiteboardId/state'),

    uploadAsset: post<UploadWhiteboardAssetInput, UploadWhiteboardAssetResponse>('/api/teams/:teamId/whiteboards/:whiteboardId/assets'),
    getAsset: get<unknown>('/api/teams/:teamId/whiteboards/:whiteboardId/assets/:assetId')
} as const;
