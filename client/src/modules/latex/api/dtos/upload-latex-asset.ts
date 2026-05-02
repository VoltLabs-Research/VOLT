import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';

export interface UploadLatexAssetParams {
    documentId: string;
    /** Optional relative path prefix applied to all uploaded files (e.g. `images/`). */
    path?: string;
    files: File[];
}

/** Result returned by the batch asset upload endpoint. */
export interface UploadLatexAssetsResult {
    uploaded: LatexAsset[];
    failedCount: number;
    total: number;
}
