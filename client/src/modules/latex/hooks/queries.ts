import service from '../api/service';
import {
    buildKeys,
    createInvalidatingMutation,
    createFolderResourceQueries,
    createQuery
} from '@/shared/infrastructure/query';
import { createMutation } from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
import type {
    FolderCreateParams,
    FolderDeleteParams,
    FolderGetParams,
    FolderListParams,
    FolderUpdateParams
} from '@/shared/api/folder-endpoints';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type {
    CompileLatexDocumentParams,
    CreateLatexDocumentParams,
    CreateLatexFileParams,
    DeleteLatexAssetParams,
    DeleteLatexDocumentParams,
    DeleteLatexFileParams,
    ExportLatexDocumentParams,
    GetLatexDocumentParams,
    ImportLatexDocumentParams,
    ImportLatexDocumentResult,
    ListLatexAssetsParams,
    ListLatexDocumentsParams,
    ListLatexFilesParams,
    MoveLatexDocumentParams,
    SetLatexFileEntrypointParams,
    UpdateLatexAssetParams,
    UpdateLatexDocumentParams,
    UpdateLatexFileParams,
    UploadLatexAssetParams,
    UploadLatexAssetsResult
} from '../api/service';
import type { LatexAsset } from '../api/entities/latex-asset';
import type { LatexDocument } from '../api/entities/latex-document';
import type { LatexFile } from '../api/entities/latex-file';
import type { LatexFolder } from '../api/entities/latex-folder';

interface LatexQueryKeys extends Record<string, unknown> {
    documents: ListLatexDocumentsParams;
    document: GetLatexDocumentParams;
    assets: ListLatexAssetsParams;
    files: ListLatexFilesParams;
    folders: FolderListParams;
    folder: FolderGetParams;
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
    FolderListParams,
    FolderGetParams,
    FolderCreateParams,
    FolderUpdateParams,
    FolderDeleteParams
>({
    baseKey: 'latex-folder',
    service: {
        listFolders: service.listFolders,
        getFolder: service.getFolder,
        createFolder: service.createFolder,
        updateFolder: service.updateFolder,
        deleteFolder: service.deleteFolder
    },
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
