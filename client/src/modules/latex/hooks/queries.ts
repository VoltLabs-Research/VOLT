import service from '../api/service';
import {
    buildKeys,
    createCachePolicy,
    createManagedMutation,
    createQuery
} from '@/shared/infrastructure/query';
import type { CreateLatexDocumentParams } from '../api/dtos/create-latex-document';
import type { DeleteLatexDocumentParams } from '../api/dtos/delete-latex-document';
import type { GetLatexDocumentParams } from '../api/dtos/get-latex-document';
import type { ListLatexDocumentsParams } from '../api/dtos/list-latex-documents';
import type { UpdateLatexDocumentParams } from '../api/dtos/update-latex-document';
import type { ListLatexAssetsParams } from '../api/dtos/list-latex-assets';
import type { UploadLatexAssetParams, UploadLatexAssetsResult } from '../api/dtos/upload-latex-asset';
import type { DeleteLatexAssetParams } from '../api/dtos/delete-latex-asset';
import type { UpdateLatexAssetParams } from '../api/dtos/update-latex-asset';
import type { CompileLatexDocumentParams } from '../api/dtos/compile-latex-document';
import type { ExportLatexDocumentParams } from '../api/dtos/export-latex-document';
import type { ImportLatexDocumentParams, ImportLatexDocumentResult } from '../api/dtos/import-latex-document';
import type { ListLatexFilesParams } from '../api/dtos/list-latex-files';
import type { CreateLatexFileParams } from '../api/dtos/create-latex-file';
import type { UpdateLatexFileParams } from '../api/dtos/update-latex-file';
import type { DeleteLatexFileParams } from '../api/dtos/delete-latex-file';
import type { SetLatexFileEntrypointParams } from '../api/dtos/set-latex-file-entrypoint';
import type { LatexDocument } from '../api/entities/latex-document';
import type { LatexAsset } from '../api/entities/latex-asset';
import type { LatexFile } from '../api/entities/latex-file';

interface LatexQueryKeys extends Record<string, unknown> {
    documents: ListLatexDocumentsParams;
    document: GetLatexDocumentParams;
    assets: ListLatexAssetsParams;
    files: ListLatexFilesParams;
};

const KEYS = buildKeys<LatexQueryKeys>('latex');
const listDocuments = (params: ListLatexDocumentsParams) => service.listDocuments(params);
const deleteDocument = (params: DeleteLatexDocumentParams) => service.deleteDocument(params);
const createDocument = (params: CreateLatexDocumentParams) => service.createDocument(params);
const updateDocument = (params: UpdateLatexDocumentParams) => service.updateDocument(params);
const uploadAsset = (params: UploadLatexAssetParams) => service.uploadAsset(params);
const deleteAsset = (params: DeleteLatexAssetParams) => service.deleteAsset(params);
const updateAsset = (params: UpdateLatexAssetParams) => service.updateAsset(params);
const createFile = (params: CreateLatexFileParams) => service.createFile(params);
const updateFile = (params: UpdateLatexFileParams) => service.updateFile(params);
const deleteFile = (params: DeleteLatexFileParams) => service.deleteFile(params);
const setFileEntrypoint = (params: SetLatexFileEntrypointParams) => service.setFileEntrypoint(params);

export const latexDocumentsQueryKey = KEYS.documents;
export const latexDocumentQueryKey = KEYS.document;
export const latexAssetsQueryKey = KEYS.assets;
export const latexFilesQueryKey = KEYS.files;

export const latexDocumentsQuery = createQuery(KEYS.documents, listDocuments);
export const latexDocumentQuery = createQuery(
    KEYS.document,
    (params: GetLatexDocumentParams) => service.getDocument(params)
);
export const latexAssetsQuery = createQuery(
    KEYS.assets,
    (params: ListLatexAssetsParams) => service.listAssets(params)
);
export const latexFilesQuery = createQuery(
    KEYS.files,
    (params: ListLatexFilesParams) => service.listFiles(params)
);

const latexDocumentsCache = createCachePolicy<void>(() => KEYS.documents());
const latexDocumentCache = createCachePolicy<GetLatexDocumentParams>(
    (params) => KEYS.document(params)
);
const latexAssetsCache = createCachePolicy<ListLatexAssetsParams>(
    (params) => KEYS.assets(params)
);
const latexFilesCache = createCachePolicy<ListLatexFilesParams>(
    (params) => KEYS.files(params)
);

export const invalidateLatexDocumentsQuery = () => latexDocumentsCache.invalidate(undefined);
export const invalidateLatexDocumentQuery = (params: GetLatexDocumentParams) =>
    latexDocumentCache.invalidate(params);
export const invalidateLatexAssetsQuery = (params: ListLatexAssetsParams) =>
    latexAssetsCache.invalidate(params);
export const invalidateLatexFilesQuery = (params: ListLatexFilesParams) =>
    latexFilesCache.invalidate(params);

export const useDeleteLatexDocumentMutation = createManagedMutation<void, DeleteLatexDocumentParams>(
    deleteDocument,
    () => invalidateLatexDocumentsQuery()
);

export const useCreateLatexDocumentMutation = createManagedMutation<LatexDocument, CreateLatexDocumentParams>(
    createDocument,
    () => invalidateLatexDocumentsQuery()
);

export const useUpdateLatexDocumentMutation = createManagedMutation<LatexDocument, UpdateLatexDocumentParams>(
    updateDocument,
    (_data, variables) => {
        invalidateLatexDocumentsQuery();
        invalidateLatexDocumentQuery({ documentId: variables.documentId });
    }
);

export const useUploadLatexAssetMutation = createManagedMutation<UploadLatexAssetsResult, UploadLatexAssetParams>(
    uploadAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useDeleteLatexAssetMutation = createManagedMutation<void, DeleteLatexAssetParams>(
    deleteAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useUpdateLatexAssetMutation = createManagedMutation<LatexAsset, UpdateLatexAssetParams>(
    updateAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useExportLatexDocumentTexMutation = createManagedMutation<Blob, ExportLatexDocumentParams>(
    (params: ExportLatexDocumentParams) => service.exportDocumentTex(params)
);

export const useExportLatexDocumentZipMutation = createManagedMutation<Blob, ExportLatexDocumentParams>(
    (params: ExportLatexDocumentParams) => service.exportDocumentZip(params)
);

export const useImportLatexDocumentMutation = createManagedMutation<ImportLatexDocumentResult, ImportLatexDocumentParams>(
    (params: ImportLatexDocumentParams) => service.importDocument(params),
    () => invalidateLatexDocumentsQuery()
);

export const useCompileLatexDocumentMutation = createManagedMutation<Blob, CompileLatexDocumentParams>(
    (params: CompileLatexDocumentParams) => service.compileDocument(params)
);

export const useCreateLatexFileMutation = createManagedMutation<LatexFile, CreateLatexFileParams>(
    createFile,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);

export const useUpdateLatexFileMutation = createManagedMutation<LatexFile, UpdateLatexFileParams>(
    updateFile,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);

export const useDeleteLatexFileMutation = createManagedMutation<void, DeleteLatexFileParams>(
    deleteFile,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);

export const useSetLatexFileEntrypointMutation = createManagedMutation<LatexFile, SetLatexFileEntrypointParams>(
    setFileEntrypoint,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);
