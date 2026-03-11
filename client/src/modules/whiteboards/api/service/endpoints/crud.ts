import { get, post, patch, del, paginated, request, download } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';
import type { ListWhiteboardsParams } from '@/modules/whiteboards/api/dtos/list-whiteboards-params';
import type { CreateWhiteboardParams } from '@/modules/whiteboards/api/dtos/create-whiteboard-params';
import type { UpdateWhiteboardParams } from '@/modules/whiteboards/api/dtos/update-whiteboard-params';
import type { DeleteWhiteboardParams } from '@/modules/whiteboards/api/dtos/delete-whiteboard-params';

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

const endpoints = {
    listWhiteboards: paginated<ListWhiteboardsParams, PaginatedResponse<Whiteboard>>('/'),
    createWhiteboard: post<CreateWhiteboardParams, Whiteboard>('/', {
        body: ({ title }) => ({ title })
    }),
    getWhiteboard: get<WhiteboardIdParams, Whiteboard>('/:whiteboardId'),
    updateWhiteboard: patch<UpdateWhiteboardParams, Whiteboard>('/:whiteboardId', {
        body: ({ title }) => ({ title })
    }),
    deleteWhiteboard: del<DeleteWhiteboardParams>('/:whiteboardId'),
    getWhiteboardState: get<WhiteboardIdParams, unknown>('/:whiteboardId/state', { unwrap: 'raw' }),
    saveWhiteboardState: patch<SaveStateParams, void>('/:whiteboardId/state', {
        body: ({ state }) => state as Record<string, unknown>
    }),
    uploadWhiteboardAsset: request<UploadAssetParams, UploadAssetResult>('POST', '/:whiteboardId/assets', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getWhiteboardAsset: download<GetAssetParams>('GET', '/:whiteboardId/assets/:assetId')
};

export default endpoints;
