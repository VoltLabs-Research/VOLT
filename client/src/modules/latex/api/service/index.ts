import { defineServiceModule } from '@/shared/api/service-module';
import client from './client';
import endpoints from './endpoints';
import type { CreateLatexDocumentParams } from '../dtos/create-latex-document';
import type { DeleteLatexDocumentParams } from '../dtos/delete-latex-document';
import type { GetLatexDocumentParams } from '../dtos/get-latex-document';
import type { ListLatexDocumentsParams } from '../dtos/list-latex-documents';
import type { UpdateLatexDocumentParams } from '../dtos/update-latex-document';
import type { ListLatexAssetsParams } from '../dtos/list-latex-assets';
import type { UploadLatexAssetParams } from '../dtos/upload-latex-asset';
import type { DeleteLatexAssetParams } from '../dtos/delete-latex-asset';
import type { LatexDocument } from '../entities/latex-document';
import type { LatexAsset } from '../entities/latex-asset';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

type LatexService = {
    listDocuments: (params: ListLatexDocumentsParams) => Promise<PaginatedResponse<LatexDocument>>;
    createDocument: (params: CreateLatexDocumentParams) => Promise<LatexDocument>;
    getDocument: (params: GetLatexDocumentParams) => Promise<LatexDocument>;
    deleteDocument: (params: DeleteLatexDocumentParams) => Promise<void>;
    updateDocument: (params: UpdateLatexDocumentParams) => Promise<LatexDocument>;
    listAssets: (params: ListLatexAssetsParams) => Promise<LatexAsset[]>;
    uploadAsset: (params: UploadLatexAssetParams) => Promise<LatexAsset>;
    deleteAsset: (params: DeleteLatexAssetParams) => Promise<void>;
};

const service = defineServiceModule({
    clients: client,
    endpoints: endpoints as never
}) as LatexService;

export default service;
