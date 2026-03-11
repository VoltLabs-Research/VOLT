import { defineServiceModule } from '@/shared/api/service-module';
import client from './client';
import endpoints from './endpoints';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { CompileLatexDocumentParams } from '../dtos/compile-latex-document';
import type { CreateLatexDocumentParams } from '../dtos/create-latex-document';
import type { CreateLatexFileParams } from '../dtos/create-latex-file';
import type { CreateLatexFolderParams } from '../dtos/create-latex-folder';
import type { DeleteLatexFolderParams } from '../dtos/delete-latex-folder';
import type { DeleteLatexAssetParams } from '../dtos/delete-latex-asset';
import type { DeleteLatexDocumentParams } from '../dtos/delete-latex-document';
import type { DeleteLatexFileParams } from '../dtos/delete-latex-file';
import type { ExportLatexDocumentParams } from '../dtos/export-latex-document';
import type { GetLatexDocumentParams } from '../dtos/get-latex-document';
import type { GetLatexFolderParams } from '../dtos/get-latex-folder';
import type { ImportLatexDocumentParams, ImportLatexDocumentResult } from '../dtos/import-latex-document';
import type { ListLatexAssetsParams } from '../dtos/list-latex-assets';
import type { ListLatexDocumentsParams } from '../dtos/list-latex-documents';
import type { ListLatexFilesParams } from '../dtos/list-latex-files';
import type { ListLatexFoldersParams } from '../dtos/list-latex-folders';
import type { MoveLatexDocumentParams } from '../dtos/move-latex-document';
import type { SetLatexFileEntrypointParams } from '../dtos/set-latex-file-entrypoint';
import type { UpdateLatexAssetParams } from '../dtos/update-latex-asset';
import type { UpdateLatexDocumentParams } from '../dtos/update-latex-document';
import type { UpdateLatexFileParams } from '../dtos/update-latex-file';
import type { UpdateLatexFolderParams } from '../dtos/update-latex-folder';
import type { UploadLatexAssetParams, UploadLatexAssetsResult } from '../dtos/upload-latex-asset';
import type { LatexAsset } from '../entities/latex-asset';
import type { LatexDocument } from '../entities/latex-document';
import type { LatexFile } from '../entities/latex-file';
import type { LatexFolder } from '../entities/latex-folder';

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

const service = defineServiceModule({
    clients: client,
    endpoints: endpoints as never
}) as LatexService;

export default service;
