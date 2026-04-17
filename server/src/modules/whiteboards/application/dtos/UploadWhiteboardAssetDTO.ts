import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type UploadWhiteboardAssetInputDTO = TeamScopedEntityIdInputDTO<'whiteboardId'> & {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
};

/** Only the asset ID is returned; callers retrieve assets via the authenticated API route. */
export interface UploadWhiteboardAssetOutputDTO {
    assetId: string;
};
