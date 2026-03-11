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
import type { UploadLatexAssetParams } from '../api/dtos/upload-latex-asset';
import type { DeleteLatexAssetParams } from '../api/dtos/delete-latex-asset';
import type { LatexDocument } from '../api/entities/latex-document';
import type { LatexAsset } from '../api/entities/latex-asset';

interface LatexQueryKeys extends Record<string, unknown> {
    documents: ListLatexDocumentsParams;
    document: GetLatexDocumentParams;
    assets: ListLatexAssetsParams;
};

const KEYS = buildKeys<LatexQueryKeys>('latex');
const listDocuments = (params: ListLatexDocumentsParams) => service.listDocuments(params);
const deleteDocument = (params: DeleteLatexDocumentParams) => service.deleteDocument(params);
const createDocument = (params: CreateLatexDocumentParams) => service.createDocument(params);
const updateDocument = (params: UpdateLatexDocumentParams) => service.updateDocument(params);
const uploadAsset = (params: UploadLatexAssetParams) => service.uploadAsset(params);
const deleteAsset = (params: DeleteLatexAssetParams) => service.deleteAsset(params);

export const latexDocumentsQueryKey = KEYS.documents;
export const latexDocumentQueryKey = KEYS.document;
export const latexAssetsQueryKey = KEYS.assets;

export const latexDocumentsQuery = createQuery(KEYS.documents, listDocuments);
export const latexDocumentQuery = createQuery(
    KEYS.document,
    (params: GetLatexDocumentParams) => service.getDocument(params)
);
export const latexAssetsQuery = createQuery(
    KEYS.assets,
    (params: ListLatexAssetsParams) => service.listAssets(params)
);

const latexDocumentsCache = createCachePolicy<void>(() => KEYS.documents());
const latexAssetsCache = createCachePolicy<ListLatexAssetsParams>(
    (params) => KEYS.assets(params)
);

export const invalidateLatexDocumentsQuery = () => latexDocumentsCache.invalidate(undefined);
export const invalidateLatexAssetsQuery = (params: ListLatexAssetsParams) =>
    latexAssetsCache.invalidate(params);

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
    () => invalidateLatexDocumentsQuery()
);

export const useUploadLatexAssetMutation = createManagedMutation<LatexAsset, UploadLatexAssetParams>(
    uploadAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);

export const useDeleteLatexAssetMutation = createManagedMutation<void, DeleteLatexAssetParams>(
    deleteAsset,
    (_data, variables) => invalidateLatexAssetsQuery({ documentId: variables.documentId })
);
