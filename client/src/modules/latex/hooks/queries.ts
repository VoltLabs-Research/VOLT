import service from '../api/service';
import {
    buildKeys,
    createInvalidatingMutation,
    createFolderResourceQueries,
    createQuery
} from '@/shared/infrastructure/query';
import { createMutation } from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
import type { PaginatedResponse } from '@/shared/domain/pagination';
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
}

const KEYS = buildKeys<LatexQueryKeys>('latex');

export const latexDocumentsQueryKey = KEYS.documents;

export const latexDocumentsQuery = createQuery(KEYS.documents, service.listDocuments);
export const latexDocumentQuery = createQuery(KEYS.document, service.getDocument);
export const latexAssetsQuery = createQuery(KEYS.assets, service.listAssets);
export const latexFilesQuery = createQuery(KEYS.files, service.listFiles);

const invalidateLatexDocumentsQuery = () => queryClient.invalidateQueries({ queryKey: KEYS.documents() });
const invalidateLatexAssetsQuery = (params: ListLatexAssetsParams) => latexAssetsQuery.invalidate(params);
export const invalidateLatexFilesQuery = (params: ListLatexFilesParams) => latexFilesQuery.invalidate(params);

const latexFolderQueries = createFolderResourceQueries<
    LatexFolder,
    PaginatedResponse<LatexFolder>,
    ListLatexFoldersParams,
    GetLatexFolderParams,
    CreateLatexFolderParams,
    UpdateLatexFolderParams,
    DeleteLatexFolderParams
>({
    baseKey: 'latex-folder',
    service: {
        listFolders: service.listFolders,
        getFolder: service.getFolder,
        createFolder: service.createFolder,
        updateFolder: service.updateFolder,
        deleteFolder: service.deleteFolder
    },
    buildFolderParams: (folderId) => ({ folderId }),
    listingQueryKeys: [KEYS.documents()]
});

export const latexFoldersQuery = latexFolderQueries.foldersQuery;
export const latexFolderQuery = latexFolderQueries.folderQuery;
export const useCreateLatexFolderMutation = latexFolderQueries.useCreateFolderMutation;
export const useUpdateLatexFolderMutation = latexFolderQueries.useUpdateFolderMutation;
export const useDeleteLatexFolderMutation = latexFolderQueries.useDeleteFolderMutation;

export const useDeleteLatexDocumentMutation = createInvalidatingMutation<void, DeleteLatexDocumentParams>(
    service.deleteDocument,
    [KEYS.documents()]
);

export const useCreateLatexDocumentMutation = createInvalidatingMutation<LatexDocument, CreateLatexDocumentParams>(
    service.createDocument,
    [KEYS.documents()]
);

export const useUpdateLatexDocumentMutation = createInvalidatingMutation<LatexDocument, UpdateLatexDocumentParams>(
    service.updateDocument,
    (_data, variables) => [
        KEYS.documents(),
        KEYS.document({ documentId: variables.documentId })
    ]
);

export const useMoveLatexDocumentMutation = createInvalidatingMutation<LatexDocument, MoveLatexDocumentParams>(
    service.moveDocument,
    (_data, variables) => [
        KEYS.documents(),
        KEYS.document({ documentId: variables.documentId })
    ]
);

export const useUploadLatexAssetMutation = createMutation<UploadLatexAssetsResult, UploadLatexAssetParams>(
    service.uploadAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useDeleteLatexAssetMutation = createMutation<void, DeleteLatexAssetParams>(
    service.deleteAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useUpdateLatexAssetMutation = createMutation<LatexAsset, UpdateLatexAssetParams>(
    service.updateAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useExportLatexDocumentTexMutation = createMutation<Blob, ExportLatexDocumentParams>(
    service.exportDocumentTex
);

export const useExportLatexDocumentZipMutation = createMutation<Blob, ExportLatexDocumentParams>(
    service.exportDocumentZip
);

export const useImportLatexDocumentMutation = createMutation<ImportLatexDocumentResult, ImportLatexDocumentParams>(
    service.importDocument,
    () => invalidateLatexDocumentsQuery()
);

export const useCompileLatexDocumentMutation = createMutation<Blob, CompileLatexDocumentParams>(
    service.compileDocument
);

export const useCreateLatexFileMutation = createMutation<LatexFile, CreateLatexFileParams>(
    service.createFile,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);

export const useUpdateLatexFileMutation = createMutation<LatexFile, UpdateLatexFileParams>(
    service.updateFile,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);

export const useDeleteLatexFileMutation = createMutation<void, DeleteLatexFileParams>(
    service.deleteFile,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);

export const useSetLatexFileEntrypointMutation = createMutation<LatexFile, SetLatexFileEntrypointParams>(
    service.setFileEntrypoint,
    (_data, variables) => invalidateLatexFilesQuery({ documentId: variables.documentId })
);
