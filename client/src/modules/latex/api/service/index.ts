import { defineServiceModule } from '@/shared/api/service-module';
import client from './client';
import endpoints from './endpoints';
import type { CreateLatexDocumentParams } from '../dtos/create-latex-document';
import type { DeleteLatexDocumentParams } from '../dtos/delete-latex-document';
import type { GetLatexDocumentParams } from '../dtos/get-latex-document';
import type { ListLatexDocumentsParams } from '../dtos/list-latex-documents';
import type { UpdateLatexDocumentParams } from '../dtos/update-latex-document';
import type { ListLatexAssetsParams } from '../dtos/list-latex-assets';
import type { UploadLatexAssetParams, UploadLatexAssetsResult } from '../dtos/upload-latex-asset';
import type { DeleteLatexAssetParams } from '../dtos/delete-latex-asset';
import type { UpdateLatexAssetParams } from '../dtos/update-latex-asset';import type { ExportLatexDocumentParams } from '../dtos/export-latex-document';
import type { ImportLatexDocumentParams, ImportLatexDocumentResult } from '../dtos/import-latex-document';
import type { CompileLatexDocumentParams } from '../dtos/compile-latex-document';
import type { ListLatexFilesParams } from '../dtos/list-latex-files';
import type { CreateLatexFileParams } from '../dtos/create-latex-file';
import type { UpdateLatexFileParams } from '../dtos/update-latex-file';
import type { DeleteLatexFileParams } from '../dtos/delete-latex-file';
import type { SetLatexFileEntrypointParams } from '../dtos/set-latex-file-entrypoint';
import type { LatexDocument } from '../entities/latex-document';
import type { LatexAsset } from '../entities/latex-asset';
import type { LatexFile } from '../entities/latex-file';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

interface LatexService {
    listDocuments: (params: ListLatexDocumentsParams) => Promise<PaginatedResponse<LatexDocument>>;
    createDocument: (params: CreateLatexDocumentParams) => Promise<LatexDocument>;
    getDocument: (params: GetLatexDocumentParams) => Promise<LatexDocument>;
    deleteDocument: (params: DeleteLatexDocumentParams) => Promise<void>;
    updateDocument: (params: UpdateLatexDocumentParams) => Promise<LatexDocument>;
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
