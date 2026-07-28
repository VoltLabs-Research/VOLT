import type { Ref } from '../../shared/base';
import type { User } from '../auth/domain';

export interface LatexDocument{
    _id: string;
    title: string;
    folder: string | null;
    createdBy?: Ref<User>;
    lastEditedBy?: Ref<User> | null;
    createdAt: string;
    updatedAt: string;
}

export interface LatexFile{
    _id: string;
    documentId: string;
    name: string;
    path: string;
    content: string;
    isEntrypoint: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LatexAsset{
    _id: string;
    documentId: string;
    originalName: string;
    path: string;
    url: string;
    mimetype: string;
    size: number;
    createdAt: string;
}

export interface LatexAssetUploadTarget extends LatexAsset{
    uploadIndex: number;
    uploadUrl: string;
    expiresAt: string;
}

export interface UploadLatexAssetResult{
    uploaded: LatexAssetUploadTarget[];
    failedCount: number;
    total: number;
}

export interface LatexFolder{
    _id: string;
    title: string;
    parent: string | null;
    createdAt: string;
    updatedAt: string;
}

export type LatexDownloadResponse = never;
