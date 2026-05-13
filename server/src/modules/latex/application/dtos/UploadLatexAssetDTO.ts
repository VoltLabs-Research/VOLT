import type { LatexAssetDTO } from './LatexAssetDTO';
import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type UploadLatexAssetInputDTO = TeamUserScopedEntityIdInputDTO<'documentId'> & {
    /** Optional relative path prefix applied to all uploaded files (e.g. `images/`). */
    path?: string;
    files: Array<{
        name: string;
        size: number;
        type?: string;
    }>;
};

export interface LatexAssetUploadTargetDTO extends LatexAssetDTO {
    uploadIndex: number;
    uploadUrl: string;
    expiresAt: string;
}

/** Result of a batch asset upload target request. */
export interface UploadLatexAssetOutputDTO {
    uploaded: LatexAssetUploadTargetDTO[];
    /** Number of files that could not be processed. */
    failedCount: number;
    total: number;
}
