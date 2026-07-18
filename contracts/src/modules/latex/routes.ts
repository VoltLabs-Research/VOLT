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

export const latexRoutes = {
    
    listDocuments: get<LatexDocumentView>('/api/latex/:teamId/documents'),
    createDocument: post<CreateLatexDocumentInput, LatexDocumentView>('/api/latex/:teamId/documents'),
    importDocument: post<never, LatexDocumentView>('/api/latex/:teamId/import'),
    getDocument: get<LatexDocumentView>('/api/latex/:teamId/documents/:documentId'),
    deleteDocument: del('/api/latex/:teamId/documents/:documentId'),
    updateDocument: patch<UpdateLatexDocumentInput, LatexDocumentView>('/api/latex/:teamId/documents/:documentId'),
    moveDocument: patch<MoveLatexDocumentInput, null>('/api/latex/:teamId/documents/:documentId/folder'),

    
    listAssets: get<LatexAssetView[]>('/api/latex/:teamId/documents/:documentId/assets'),
    getAssetContent: get<LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/assets/content'),
    uploadAsset: post<UploadLatexAssetInput, UploadLatexAssetResult>('/api/latex/:teamId/documents/:documentId/assets'),
    deleteAsset: del('/api/latex/:teamId/documents/:documentId/assets/:assetId'),
    updateAsset: patch<UpdateLatexAssetInput, LatexAssetView>('/api/latex/:teamId/documents/:documentId/assets/:assetId'),

    
    exportDocumentTex: get<LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/export/tex'),
    exportDocumentZip: get<LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/export/zip'),
    compileDocument: post<never, LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/compile'),

    
    listFiles: get<LatexFileView[]>('/api/latex/:teamId/documents/:documentId/files'),
    createFile: post<CreateLatexFileInput, LatexFileView>('/api/latex/:teamId/documents/:documentId/files'),
    updateFile: patch<UpdateLatexFileInput, LatexFileView>('/api/latex/:teamId/documents/:documentId/files/:fileId'),
    deleteFile: del('/api/latex/:teamId/documents/:documentId/files/:fileId'),
    setFileEntrypoint: post<never, LatexFileView>('/api/latex/:teamId/documents/:documentId/files/:fileId/entrypoint'),

    
    listFolders: get<LatexFolderView>('/api/latex/:teamId/folders'),
    getFolder: get<LatexFolderView>('/api/latex/:teamId/folders/:folderId'),
    createFolder: post<CreateLatexFolderInput, LatexFolderView>('/api/latex/:teamId/folders'),
    updateFolder: patch<UpdateLatexFolderInput, LatexFolderView>('/api/latex/:teamId/folders/:folderId'),
    removeFolder: del('/api/latex/:teamId/folders/:folderId')
} as const;
