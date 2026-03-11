import { get, del, patch, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { ListLatexAssetsParams } from '@/modules/latex/api/dtos/list-latex-assets';
import type { UploadLatexAssetParams, UploadLatexAssetsResult } from '@/modules/latex/api/dtos/upload-latex-asset';
import type { DeleteLatexAssetParams } from '@/modules/latex/api/dtos/delete-latex-asset';
import type { UpdateLatexAssetParams } from '@/modules/latex/api/dtos/update-latex-asset';

const assetEndpoints = {
    listAssets: get<ListLatexAssetsParams, LatexAsset[]>('/documents/:documentId/assets'),
    uploadAsset: request<UploadLatexAssetParams, UploadLatexAssetsResult>('POST', '/documents/:documentId/assets', {
        body: ({ files, path: assetPath }) => buildFileFormData(
            files.map((file) => ({ name: 'files', file })),
            assetPath ? { path: assetPath } : undefined
        ),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    deleteAsset: del<DeleteLatexAssetParams>('/documents/:documentId/assets/:assetId'),
    updateAsset: patch<UpdateLatexAssetParams, LatexAsset>(
        '/documents/:documentId/assets/:assetId',
        { body: ({ path }) => ({ path }) }
    )
};

export default assetEndpoints;
