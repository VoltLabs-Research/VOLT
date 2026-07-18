import { get, post, patch, del } from '../../shared/routing';
import type {
    CreateLatexDocumentInput,
    UpdateLatexDocumentInput,
    MoveLatexDocumentInput,
    CreateLatexFileInput,
    UpdateLatexFileInput,
    UpdateLatexAssetInput,
    UploadLatexAssetInput,
    CreateLatexFolderInput,
    UpdateLatexFolderInput
} from './http';
import type {
    LatexDocumentView,
    LatexFileView,
    LatexAssetView,
    UploadLatexAssetResult,
    LatexFolderView,
    LatexDownloadResponse
} from './domain';

/**
 * Every client-facing latex endpoint, typed by request/response. All paths are
 * the full wire paths (team-scoped under `/api/latex/:teamId`), matching the
 * previous `createHttpModule({ basePath: '/api/latex/:teamId', resource:
 * Resource.LATEX, teamScope: BasePath })` routing verbatim. Order matters for
 * the controller: literal `/documents/:documentId/...` sub-routes are declared
 * before shorter param routes so Express matches identically, and `/import` /
 * `/folders` stay in their original positions. The compile/export/asset-content
 * rows are binary downloads streamed via `@Res()`.
 */
export const latexRoutes = {
    // ---- Documents ----
    listDocuments: get<LatexDocumentView>('/api/latex/:teamId/documents'),
    createDocument: post<CreateLatexDocumentInput, LatexDocumentView>('/api/latex/:teamId/documents'),
    importDocument: post<never, LatexDocumentView>('/api/latex/:teamId/import'),
    getDocument: get<LatexDocumentView>('/api/latex/:teamId/documents/:documentId'),
    deleteDocument: del('/api/latex/:teamId/documents/:documentId'),
    updateDocument: patch<UpdateLatexDocumentInput, LatexDocumentView>('/api/latex/:teamId/documents/:documentId'),
    moveDocument: patch<MoveLatexDocumentInput, null>('/api/latex/:teamId/documents/:documentId/folder'),

    // ---- Assets ----
    listAssets: get<LatexAssetView[]>('/api/latex/:teamId/documents/:documentId/assets'),
    getAssetContent: get<LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/assets/content'),
    uploadAsset: post<UploadLatexAssetInput, UploadLatexAssetResult>('/api/latex/:teamId/documents/:documentId/assets'),
    deleteAsset: del('/api/latex/:teamId/documents/:documentId/assets/:assetId'),
    updateAsset: patch<UpdateLatexAssetInput, LatexAssetView>('/api/latex/:teamId/documents/:documentId/assets/:assetId'),

    // ---- Export / compile (binary downloads via @Res) ----
    exportDocumentTex: get<LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/export/tex'),
    exportDocumentZip: get<LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/export/zip'),
    compileDocument: post<never, LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/compile'),

    // ---- Files ----
    listFiles: get<LatexFileView[]>('/api/latex/:teamId/documents/:documentId/files'),
    createFile: post<CreateLatexFileInput, LatexFileView>('/api/latex/:teamId/documents/:documentId/files'),
    updateFile: patch<UpdateLatexFileInput, LatexFileView>('/api/latex/:teamId/documents/:documentId/files/:fileId'),
    deleteFile: del('/api/latex/:teamId/documents/:documentId/files/:fileId'),
    setFileEntrypoint: post<never, LatexFileView>('/api/latex/:teamId/documents/:documentId/files/:fileId/entrypoint'),

    // ---- Folders ----
    listFolders: get<LatexFolderView>('/api/latex/:teamId/folders'),
    getFolder: get<LatexFolderView>('/api/latex/:teamId/folders/:folderId'),
    createFolder: post<CreateLatexFolderInput, LatexFolderView>('/api/latex/:teamId/folders'),
    updateFolder: patch<UpdateLatexFolderInput, LatexFolderView>('/api/latex/:teamId/folders/:folderId'),
    removeFolder: del('/api/latex/:teamId/folders/:folderId')
} as const;
