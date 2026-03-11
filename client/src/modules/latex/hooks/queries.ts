import service from '../api/service';
import {
    buildKeys,
    createCachePolicy,
    createManagedMutation,
    createQuery
} from '@/shared/infrastructure/query';
import type { CompileLatexDocumentParams } from '../api/dtos/compile-latex-document';
import type { CreateLatexDocumentParams } from '../api/dtos/create-latex-document';
import type { CreateLatexFileParams } from '../api/dtos/create-latex-file';
import type { CreateLatexFolderParams } from '../api/dtos/create-latex-folder';
import type { DeleteLatexAssetParams } from '../api/dtos/delete-latex-asset';
import type { DeleteLatexDocumentParams } from '../api/dtos/delete-latex-document';
import type { DeleteLatexFileParams } from '../api/dtos/delete-latex-file';
import type { DeleteLatexFolderParams } from '../api/dtos/delete-latex-folder';
import type { ExportLatexDocumentParams } from '../api/dtos/export-latex-document';
import type { GetLatexDocumentParams } from '../api/dtos/get-latex-document';
import type { GetLatexFolderParams } from '../api/dtos/get-latex-folder';
import type { ImportLatexDocumentParams, ImportLatexDocumentResult } from '../api/dtos/import-latex-document';
import type { ListLatexAssetsParams } from '../api/dtos/list-latex-assets';
import type { ListLatexDocumentsParams } from '../api/dtos/list-latex-documents';
import type { ListLatexFilesParams } from '../api/dtos/list-latex-files';
import type { ListLatexFoldersParams } from '../api/dtos/list-latex-folders';
import type { MoveLatexDocumentParams } from '../api/dtos/move-latex-document';
import type { SetLatexFileEntrypointParams } from '../api/dtos/set-latex-file-entrypoint';
import type { UpdateLatexAssetParams } from '../api/dtos/update-latex-asset';
import type { UpdateLatexDocumentParams } from '../api/dtos/update-latex-document';
import type { UpdateLatexFileParams } from '../api/dtos/update-latex-file';
import type { UpdateLatexFolderParams } from '../api/dtos/update-latex-folder';
import type { UploadLatexAssetParams, UploadLatexAssetsResult } from '../api/dtos/upload-latex-asset';
import type { LatexAsset } from '../api/entities/latex-asset';
import type { LatexDocument } from '../api/entities/latex-document';
import type { LatexFile } from '../api/entities/latex-file';
import type { LatexFolder } from '../api/entities/latex-folder';

interface LatexQueryKeys extends Record<string, unknown> {
    documents: ListLatexDocumentsParams;
    document: GetLatexDocumentParams;
    assets: ListLatexAssetsParams;
    files: ListLatexFilesParams;
    folders: ListLatexFoldersParams;
    folder: GetLatexFolderParams;
};

const KEYS = buildKeys<LatexQueryKeys>('latex');

export const latexDocumentsQueryKey = KEYS.documents;
export const latexDocumentQueryKey = KEYS.document;
export const latexAssetsQueryKey = KEYS.assets;
export const latexFilesQueryKey = KEYS.files;
export const latexFoldersQueryKey = KEYS.folders;
export const latexFolderQueryKey = KEYS.folder;

export const latexDocumentsQuery = createQuery(KEYS.documents, service.listDocuments);
export const latexDocumentQuery = createQuery(KEYS.document, service.getDocument);
export const latexAssetsQuery = createQuery(KEYS.assets, service.listAssets);
export const latexFilesQuery = createQuery(KEYS.files, service.listFiles);
export const latexFoldersQuery = createQuery(KEYS.folders, service.listFolders);
export const latexFolderQuery = createQuery(KEYS.folder, service.getFolder);

const latexDocumentsCache = createCachePolicy<void>(() => KEYS.documents());
const latexDocumentCache = createCachePolicy<GetLatexDocumentParams>((params) => KEYS.document(params));
const latexAssetsCache = createCachePolicy<ListLatexAssetsParams>((params) => KEYS.assets(params));
const latexFilesCache = createCachePolicy<ListLatexFilesParams>((params) => KEYS.files(params));
const latexFoldersCache = createCachePolicy<void>(() => KEYS.folders());
const latexFolderCache = createCachePolicy<GetLatexFolderParams>((params) => KEYS.folder(params));

export const invalidateLatexDocumentsQuery = () => latexDocumentsCache.invalidate(undefined);
export const invalidateLatexDocumentQuery = (params: GetLatexDocumentParams) => latexDocumentCache.invalidate(params);
export const invalidateLatexAssetsQuery = (params: ListLatexAssetsParams) => latexAssetsCache.invalidate(params);
export const invalidateLatexFilesQuery = (params: ListLatexFilesParams) => latexFilesCache.invalidate(params);
export const invalidateLatexFoldersQuery = () => latexFoldersCache.invalidate(undefined);
export const invalidateLatexFolderQuery = (params: GetLatexFolderParams) => latexFolderCache.invalidate(params);

export const useDeleteLatexDocumentMutation = createManagedMutation<void, DeleteLatexDocumentParams>(
    service.deleteDocument,
    () => invalidateLatexDocumentsQuery()
);

export const useCreateLatexDocumentMutation = createManagedMutation<LatexDocument, CreateLatexDocumentParams>(
    service.createDocument,
    () => invalidateLatexDocumentsQuery()
);

export const useUpdateLatexDocumentMutation = createManagedMutation<LatexDocument, UpdateLatexDocumentParams>(
    service.updateDocument,
    (_data, variables) => {
        invalidateLatexDocumentsQuery();
        invalidateLatexDocumentQuery({ documentId: variables.documentId });
    }
);

export const useMoveLatexDocumentMutation = createManagedMutation<LatexDocument, MoveLatexDocumentParams>(
    service.moveDocument,
    () => invalidateLatexDocumentsQuery()
);

export const useCreateLatexFolderMutation = createManagedMutation<LatexFolder, CreateLatexFolderParams>(
    service.createFolder,
    () => invalidateLatexFoldersQuery()
);

export const useUpdateLatexFolderMutation = createManagedMutation<LatexFolder, UpdateLatexFolderParams>(
    service.updateFolder,
    (_data, variables) => {
        invalidateLatexFoldersQuery();
        invalidateLatexDocumentsQuery();
        invalidateLatexFolderQuery({ folderId: variables.folderId });
    }
);

export const useDeleteLatexFolderMutation = createManagedMutation<void, DeleteLatexFolderParams>(
    service.deleteFolder,
    (_data, variables) => {
        invalidateLatexFoldersQuery();
        invalidateLatexDocumentsQuery();
        invalidateLatexFolderQuery({ folderId: variables.folderId });
    }
);

export const useUploadLatexAssetMutation = createManagedMutation<UploadLatexAssetsResult, UploadLatexAssetParams>(
    service.uploadAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useDeleteLatexAssetMutation = createManagedMutation<void, DeleteLatexAssetParams>(
    service.deleteAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useUpdateLatexAssetMutation = createManagedMutation<LatexAsset, UpdateLatexAssetParams>(
    service.updateAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useExportLatexDocumentTexMutation = createManagedMutation<Blob, ExportLatexDocumentParams>(
    service.exportDocumentTex
);

export const useExportLatexDocumentZipMutation = createManagedMutation<Blob, ExportLatexDocumentParams>(
    service.exportDocumentZip
);

export const useImportLatexDocumentMutation = createManagedMutation<ImportLatexDocumentResult, ImportLatexDocumentParams>(
    service.importDocument,
    () => invalidateLatexDocumentsQuery()
);

export const useCompileLatexDocumentMutation = createManagedMutation<Blob, CompileLatexDocumentParams>(
    service.compileDocument
);

export const useCreateLatexFileMutation = createManagedMutation<LatexFile, CreateLatexFileParams>(
    service.createFile,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);

export const useUpdateLatexFileMutation = createManagedMutation<LatexFile, UpdateLatexFileParams>(
    service.updateFile,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);

export const useDeleteLatexFileMutation = createManagedMutation<void, DeleteLatexFileParams>(
    service.deleteFile,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);

export const useSetLatexFileEntrypointMutation = createManagedMutation<LatexFile, SetLatexFileEntrypointParams>(
    service.setFileEntrypoint,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);
