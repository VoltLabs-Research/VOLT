import { createService, paginated, get, post, patch, del, download, request } from '@/app/core/http/utilities/create-service';
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

interface LatexService {
    listDocuments: (params: ListLatexDocumentsParams) => Promise<PaginatedResponse<LatexDocument>>;
    createDocument: (params: CreateLatexDocumentParams) => Promise<LatexDocument>;
    getDocument: (params: GetLatexDocumentParams) => Promise<LatexDocument>;
    deleteDocument: (params: DeleteLatexDocumentParams) => Promise<void>;
    updateDocument: (params: UpdateLatexDocumentParams) => Promise<LatexDocument>;
    moveDocument: (params: MoveLatexDocumentParams) => Promise<LatexDocument>;
    listFolders: (params: FolderListParams) => Promise<PaginatedResponse<LatexFolder>>;
    getFolder: (params: FolderGetParams) => Promise<LatexFolder>;
    createFolder: (params: FolderCreateParams) => Promise<LatexFolder>;
    updateFolder: (params: FolderUpdateParams) => Promise<LatexFolder>;
    deleteFolder: (params: FolderDeleteParams) => Promise<void>;
    listAssets: (params: ListLatexAssetsParams) => Promise<LatexAsset[]>;
    uploadAsset: (params: UploadLatexAssetParams) => Promise<UploadLatexAssetsResult>;
    deleteAsset: (params: DeleteLatexAssetParams) => Promise<void>;
    updateAsset: (params: UpdateLatexAssetParams) => Promise<LatexAsset>;
    exportDocumentTex: (params: ExportLatexDocumentParams) => Promise<Blob>;
    exportDocumentZip: (params: ExportLatexDocumentParams) => Promise<Blob>;
    importDocument: (params: ImportLatexDocumentParams) => Promise<ImportLatexDocumentResult>;
    compileDocument: (params: CompileLatexDocumentParams) => Promise<Blob>;
    listFiles: (params: ListLatexFilesParams) => Promise<LatexFile[]>;
    createFile: (params: CreateLatexFileParams) => Promise<LatexFile>;
    updateFile: (params: UpdateLatexFileParams) => Promise<LatexFile>;
    deleteFile: (params: DeleteLatexFileParams) => Promise<void>;
    setFileEntrypoint: (params: SetLatexFileEntrypointParams) => Promise<LatexFile>;
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
    uploadAsset: request<UploadLatexAssetParams, UploadLatexAssetsResult>('POST', '/documents/:documentId/assets', {
        body: ({ files, path: assetPath }) => buildFileFormData(
            files.map((file) => ({ name: 'files', file })),
            assetPath ? { path: assetPath } : undefined
        ),
        headers: { 'Content-Type': 'multipart/form-data' }
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

const service: LatexService = createService({
    clients: {
        default: {
            basePath: '/latex',
            useRBAC: true
        }
    }
}, endpoints);

export default service;
