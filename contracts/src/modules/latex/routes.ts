import { get, post, patch, put, del } from '../../shared/routing';
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
    LatexDocument,
    LatexFile,
    LatexAsset,
    UploadLatexAssetResult,
    LatexFolder,
    LatexDownloadResponse
} from './domain';

export const latexRoutes = {
    listDocuments: get<LatexDocument>('/api/teams/:teamId/latex-documents'),
    createDocument: post<CreateLatexDocumentInput, LatexDocument>('/api/teams/:teamId/latex-documents'),
    importDocument: post<never, LatexDocument>('/api/teams/:teamId/latex-document-imports'),
    getDocument: get<LatexDocument>('/api/teams/:teamId/latex-documents/:documentId'),
    deleteDocument: del('/api/teams/:teamId/latex-documents/:documentId'),
    updateDocument: patch<UpdateLatexDocumentInput, LatexDocument>('/api/teams/:teamId/latex-documents/:documentId'),
    moveDocument: patch<MoveLatexDocumentInput, null>('/api/teams/:teamId/latex-documents/:documentId/folder'),

    listAssets: get<LatexAsset[]>('/api/teams/:teamId/latex-documents/:documentId/assets'),
    getAssetContent: get<LatexDownloadResponse>('/api/teams/:teamId/latex-documents/:documentId/assets/content'),
    uploadAsset: post<UploadLatexAssetInput, UploadLatexAssetResult>('/api/teams/:teamId/latex-documents/:documentId/assets'),
    deleteAsset: del('/api/teams/:teamId/latex-documents/:documentId/assets/:assetId'),
    updateAsset: patch<UpdateLatexAssetInput, LatexAsset>('/api/teams/:teamId/latex-documents/:documentId/assets/:assetId'),

    exportDocumentTex: get<LatexDownloadResponse>('/api/teams/:teamId/latex-documents/:documentId/export/tex'),
    exportDocumentZip: get<LatexDownloadResponse>('/api/teams/:teamId/latex-documents/:documentId/export/zip'),
    compileDocument: post<never, LatexDownloadResponse>('/api/teams/:teamId/latex-documents/:documentId/compilations'),

    listFiles: get<LatexFile[]>('/api/teams/:teamId/latex-documents/:documentId/files'),
    createFile: post<CreateLatexFileInput, LatexFile>('/api/teams/:teamId/latex-documents/:documentId/files'),
    updateFile: patch<UpdateLatexFileInput, LatexFile>('/api/teams/:teamId/latex-documents/:documentId/files/:fileId'),
    deleteFile: del('/api/teams/:teamId/latex-documents/:documentId/files/:fileId'),
    setFileEntrypoint: put<never, LatexFile>('/api/teams/:teamId/latex-documents/:documentId/files/:fileId/entrypoint'),

    listFolders: get<LatexFolder>('/api/teams/:teamId/latex-folders'),
    getFolder: get<LatexFolder>('/api/teams/:teamId/latex-folders/:folderId'),
    createFolder: post<CreateLatexFolderInput, LatexFolder>('/api/teams/:teamId/latex-folders'),
    updateFolder: patch<UpdateLatexFolderInput, LatexFolder>('/api/teams/:teamId/latex-folders/:folderId'),
    removeFolder: del('/api/teams/:teamId/latex-folders/:folderId')
} as const;
