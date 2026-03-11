import { get, del, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { ListLatexAssetsParams } from '@/modules/latex/api/dtos/list-latex-assets';
import type { UploadLatexAssetParams } from '@/modules/latex/api/dtos/upload-latex-asset';
import type { DeleteLatexAssetParams } from '@/modules/latex/api/dtos/delete-latex-asset';

const assetEndpoints = {
    listAssets: get<ListLatexAssetsParams, LatexAsset[]>('/documents/:documentId/assets'),
    uploadAsset: request<UploadLatexAssetParams, LatexAsset>('POST', '/documents/:documentId/assets', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    deleteAsset: del<DeleteLatexAssetParams>('/documents/:documentId/assets/:assetId')
};

export default assetEndpoints;
