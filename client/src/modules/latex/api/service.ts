import { createService, paginated, get, post, patch, del, download, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import { createFolderCrudEndpoints } from '@/shared/api/folder-endpoints';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { CompileLatexDocumentParams } from './dtos/compile-latex-document';
import type { CreateLatexDocumentParams } from './dtos/create-latex-document';
import type { CreateLatexFileParams } from './dtos/create-latex-file';
import type { CreateLatexFolderParams } from './dtos/create-latex-folder';
import type { DeleteLatexFolderParams } from './dtos/delete-latex-folder';
import type { DeleteLatexAssetParams } from './dtos/delete-latex-asset';
import type { DeleteLatexDocumentParams } from './dtos/delete-latex-document';
import type { DeleteLatexFileParams } from './dtos/delete-latex-file';
import type { ExportLatexDocumentParams } from './dtos/export-latex-document';
import type { GetLatexDocumentParams } from './dtos/get-latex-document';
import type { GetLatexFolderParams } from './dtos/get-latex-folder';
import type { ImportLatexDocumentParams, ImportLatexDocumentResult } from './dtos/import-latex-document';
import type { ListLatexAssetsParams } from './dtos/list-latex-assets';
import type { ListLatexDocumentsParams } from './dtos/list-latex-documents';
import type { ListLatexFilesParams } from './dtos/list-latex-files';
import type { ListLatexFoldersParams } from './dtos/list-latex-folders';
import type { MoveLatexDocumentParams } from './dtos/move-latex-document';
import type { SetLatexFileEntrypointParams } from './dtos/set-latex-file-entrypoint';
import type { UpdateLatexAssetParams } from './dtos/update-latex-asset';
import type { UpdateLatexDocumentParams } from './dtos/update-latex-document';
import type { UpdateLatexFileParams } from './dtos/update-latex-file';
import type { UpdateLatexFolderParams } from './dtos/update-latex-folder';
import type { UploadLatexAssetParams, UploadLatexAssetsResult } from './dtos/upload-latex-asset';
import type { LatexAsset } from './entities/latex-asset';
import type { LatexDocument } from './entities/latex-document';
import type { LatexFile } from './entities/latex-file';
import type { LatexFolder } from './entities/latex-folder';

interface LatexService {
    listDocuments: (params: ListLatexDocumentsParams) => Promise<PaginatedResponse<LatexDocument>>;
    createDocument: (params: CreateLatexDocumentParams) => Promise<LatexDocument>;
    getDocument: (params: GetLatexDocumentParams) => Promise<LatexDocument>;
    deleteDocument: (params: DeleteLatexDocumentParams) => Promise<void>;
    updateDocument: (params: UpdateLatexDocumentParams) => Promise<LatexDocument>;
    moveDocument: (params: MoveLatexDocumentParams) => Promise<LatexDocument>;
    listFolders: (params: ListLatexFoldersParams) => Promise<PaginatedResponse<LatexFolder>>;
    getFolder: (params: GetLatexFolderParams) => Promise<LatexFolder>;
    createFolder: (params: CreateLatexFolderParams) => Promise<LatexFolder>;
    updateFolder: (params: UpdateLatexFolderParams) => Promise<LatexFolder>;
    deleteFolder: (params: DeleteLatexFolderParams) => Promise<void>;
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
};

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
        ListLatexFoldersParams,
        GetLatexFolderParams,
        CreateLatexFolderParams,
        UpdateLatexFolderParams,
        DeleteLatexFolderParams,
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
