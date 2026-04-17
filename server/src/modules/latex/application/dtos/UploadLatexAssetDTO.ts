import type { LatexAssetDTO } from './LatexAssetDTO';
import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type UploadLatexAssetInputDTO = TeamUserScopedEntityIdInputDTO<'documentId'> & {
    /** Optional relative path prefix applied to all uploaded files (e.g. `images/`). */
    path?: string;
    files: Express.Multer.File[];
};

/** Result of a batch asset upload. Includes only the assets that were successfully persisted. */
export interface UploadLatexAssetOutputDTO {
    uploaded: LatexAssetDTO[];
    /** Number of files that could not be processed. */
    failedCount: number;
    total: number;
};
