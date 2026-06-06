import { createService, custom, paginated, get, post, patch, del, download, request } from '@/app/core/http/utilities/create-service';
import { uploadClusterObjectParts } from '@/shared/api/cluster-object-upload';
import { buildFileFormData } from '@/shared/utils/file';
import {
    createFolderCrudEndpoints,
    type FolderCreateParams,
    type FolderDeleteParams,
    type FolderGetParams,
    type FolderListParams,
    type FolderUpdateParams
} from '@/shared/api/folder-endpoints';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { LatexAsset } from './entities/latex-asset';
import type { LatexDocument } from './entities/latex-document';
import type { LatexFile } from './entities/latex-file';
import type { LatexFolder } from './entities/latex-folder';

export interface CompileLatexDocumentParams {
    documentId: string;
}

export interface CreateLatexDocumentParams {
    title: string;
    folderId?: string | null;
}

export interface CreateLatexFileParams {
    documentId: string;
    name: string;
    path?: string;
    content?: string;
    isEntrypoint?: boolean;
}

export interface DeleteLatexAssetParams {
    documentId: string;
    assetId: string;
}

export interface DeleteLatexDocumentParams {
    documentId: string;
}

export interface DeleteLatexFileParams {
    documentId: string;
    fileId: string;
}

export interface ExportLatexDocumentParams {
    documentId: string;
}

export interface GetLatexDocumentParams {
    documentId: string;
}

export interface ImportLatexDocumentParams {
    file: File;
    folderId?: string | null;
}

export type ImportLatexDocumentResult = LatexDocument;

export interface ListLatexAssetsParams {
    documentId: string;
}

export interface ListLatexDocumentsParams {
    page?: number;
    limit?: number;
    search?: string;
    folderId?: string;
}

export interface ListLatexFilesParams {
    documentId: string;
}

export interface MoveLatexDocumentParams {
    documentId: string;
    folderId: string | null;
}

export interface SetLatexFileEntrypointParams {
    documentId: string;
    fileId: string;
}

export interface UpdateLatexAssetParams {
    documentId: string;
    assetId: string;
    path: string;
}

export interface UpdateLatexDocumentParams {
    documentId: string;
    title?: string;
}

export interface UpdateLatexFileParams {
    documentId: string;
    fileId: string;
    name?: string;
    path?: string;
    content?: string;
}

export interface UploadLatexAssetParams {
    documentId: string;
    path?: string;
    files: File[];
}

export interface UploadLatexAssetsResult {
    uploaded: LatexAsset[];
    failedCount: number;
    total: number;
}

interface LatexAssetUploadTarget extends LatexAsset {
    uploadIndex: number;
    uploadUrl: string;
    expiresAt: string;
}

interface UploadLatexAssetApiResponse {
    status: 'success';
    data: {
        uploaded: LatexAssetUploadTarget[];
        failedCount: number;
        total: number;
    };
}

const endpoints = {
    listDocuments: paginated<ListLatexDocumentsParams, PaginatedResponse<LatexDocument>>(
        '/documents'
    ),
    createDocument: post<CreateLatexDocumentParams, LatexDocument>('/documents', {
        body: ({ title, folderId }) => ({ title, folderId })
    }),
    getDocument: get<GetLatexDocumentParams, LatexDocument>('/documents/:documentId'),
    deleteDocument: del<DeleteLatexDocumentParams>('/documents/:documentId'),
    updateDocument: patch<UpdateLatexDocumentParams, LatexDocument>('/documents/:documentId', {
        body: ({ title }) => ({ title })
    }),
    moveDocument: patch<MoveLatexDocumentParams, LatexDocument>('/documents/:documentId/folder', {
        body: ({ folderId }) => ({ folderId })
    }),
    listAssets: get<ListLatexAssetsParams, LatexAsset[]>('/documents/:documentId/assets'),
    uploadAsset: custom<UploadLatexAssetParams, UploadLatexAssetsResult>(async ({ getClient }, params) => {
        const response = await getClient().request<UploadLatexAssetApiResponse>(
            'POST',
            `/documents/${params.documentId}/assets`,
            {
                body: {
                    ...(params.path ? { path: params.path } : {}),
                    files: params.files.map((file) => ({
                        name: file.name,
                        size: file.size,
                        ...(file.type ? { type: file.type } : {})
                    }))
                }
            }
        );

        await Promise.all(response.data.uploaded.map(async (asset) => {
            const file = params.files[asset.uploadIndex];
            if (!file) return;

            await uploadClusterObjectParts({
                file,
                parts: [{
                    url: asset.uploadUrl,
                    offset: 0,
                    size: file.size
                }],
                concurrency: 1
            });
        }));

        return {
            uploaded: response.data.uploaded.map(({
                uploadIndex: _uploadIndex,
                uploadUrl: _uploadUrl,
                expiresAt: _expiresAt,
                ...asset
            }) => asset),
            failedCount: response.data.failedCount,
            total: response.data.total
        };
    }),
    deleteAsset: del<DeleteLatexAssetParams>('/documents/:documentId/assets/:assetId'),
    updateAsset: patch<UpdateLatexAssetParams, LatexAsset>(
        '/documents/:documentId/assets/:assetId',
        { body: ({ path }) => ({ path }) }
    ),
    exportDocumentTex: download<ExportLatexDocumentParams>('GET', '/documents/:documentId/export/tex'),
    exportDocumentZip: download<ExportLatexDocumentParams>('GET', '/documents/:documentId/export/zip'),
    importDocument: request<ImportLatexDocumentParams, ImportLatexDocumentResult>('POST', '/import', {
        body: ({ file, folderId }) => buildFileFormData(
            [{ name: 'file', file }],
            folderId ? { folderId } : undefined
        ),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    compileDocument: download<CompileLatexDocumentParams>('POST', '/documents/:documentId/compile'),
    listFiles: get<ListLatexFilesParams, LatexFile[]>('/documents/:documentId/files'),
    createFile: post<CreateLatexFileParams, LatexFile>('/documents/:documentId/files', {
        body: ({ name, path, content, isEntrypoint }) => ({
            name,
            path,
            content,
            isEntrypoint
        })
    }),
    updateFile: patch<UpdateLatexFileParams, LatexFile>('/documents/:documentId/files/:fileId', {
        body: ({ name, path, content }) => ({ name, path, content })
    }),
    deleteFile: del<DeleteLatexFileParams>('/documents/:documentId/files/:fileId'),
    setFileEntrypoint: post<SetLatexFileEntrypointParams, LatexFile>(
        '/documents/:documentId/files/:fileId/entrypoint',
        { body: () => ({}) }
    ),
    ...createFolderCrudEndpoints<
        FolderListParams,
        FolderGetParams,
        FolderCreateParams,
        FolderUpdateParams,
        FolderDeleteParams,
        LatexFolder
    >()
};

const service = createService({
    clients: {
        default: {
            basePath: '/latex',
            useRBAC: true
        }
    }
}, endpoints);

export default service;
