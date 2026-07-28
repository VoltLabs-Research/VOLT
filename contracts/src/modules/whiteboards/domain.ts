import type { Ref } from '../../shared/base';
import type { User } from '../auth/domain';

export interface Whiteboard{
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: Ref<User> | null;
    createdAt: string;
    updatedAt: string;
}

export interface WhiteboardFolder{
    _id: string;
    title: string;
    parent: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateWhiteboardResponse{
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    createdAt: string;
    updatedAt: string;
}

export type GetWhiteboardResponse = Whiteboard;

export interface UpdateWhiteboardResponse{
    _id: string;
    title: string;
    updatedAt: string;
}

export interface UploadWhiteboardAssetResponse{
    assetId: string;
    uploadUrl: string;
    expiresAt: string;
}
