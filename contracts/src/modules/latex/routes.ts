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
    LatexDocument,
    LatexFile,
    LatexAsset,
    UploadLatexAssetResult,
    LatexFolder,
    LatexDownloadResponse
} from './domain';

export const latexRoutes = {
    
    listDocuments: get<LatexDocument>('/api/latex/:teamId/documents'),
    createDocument: post<CreateLatexDocumentInput, LatexDocument>('/api/latex/:teamId/documents'),
    importDocument: post<never, LatexDocument>('/api/latex/:teamId/import'),
    getDocument: get<LatexDocument>('/api/latex/:teamId/documents/:documentId'),
    deleteDocument: del('/api/latex/:teamId/documents/:documentId'),
    updateDocument: patch<UpdateLatexDocumentInput, LatexDocument>('/api/latex/:teamId/documents/:documentId'),
    moveDocument: patch<MoveLatexDocumentInput, null>('/api/latex/:teamId/documents/:documentId/folder'),

    
    listAssets: get<LatexAsset[]>('/api/latex/:teamId/documents/:documentId/assets'),
    getAssetContent: get<LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/assets/content'),
    uploadAsset: post<UploadLatexAssetInput, UploadLatexAssetResult>('/api/latex/:teamId/documents/:documentId/assets'),
    deleteAsset: del('/api/latex/:teamId/documents/:documentId/assets/:assetId'),
    updateAsset: patch<UpdateLatexAssetInput, LatexAsset>('/api/latex/:teamId/documents/:documentId/assets/:assetId'),

    
    exportDocumentTex: get<LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/export/tex'),
    exportDocumentZip: get<LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/export/zip'),
    compileDocument: post<never, LatexDownloadResponse>('/api/latex/:teamId/documents/:documentId/compile'),

    
    listFiles: get<LatexFile[]>('/api/latex/:teamId/documents/:documentId/files'),
    createFile: post<CreateLatexFileInput, LatexFile>('/api/latex/:teamId/documents/:documentId/files'),
    updateFile: patch<UpdateLatexFileInput, LatexFile>('/api/latex/:teamId/documents/:documentId/files/:fileId'),
    deleteFile: del('/api/latex/:teamId/documents/:documentId/files/:fileId'),
    setFileEntrypoint: post<never, LatexFile>('/api/latex/:teamId/documents/:documentId/files/:fileId/entrypoint'),

    
    listFolders: get<LatexFolder>('/api/latex/:teamId/folders'),
    getFolder: get<LatexFolder>('/api/latex/:teamId/folders/:folderId'),
    createFolder: post<CreateLatexFolderInput, LatexFolder>('/api/latex/:teamId/folders'),
    updateFolder: patch<UpdateLatexFolderInput, LatexFolder>('/api/latex/:teamId/folders/:folderId'),
    removeFolder: del('/api/latex/:teamId/folders/:folderId')
} as const;
