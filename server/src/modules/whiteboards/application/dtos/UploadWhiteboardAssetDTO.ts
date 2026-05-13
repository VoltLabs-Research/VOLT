import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type UploadWhiteboardAssetInputDTO = TeamUserScopedEntityIdInputDTO<'whiteboardId'> & {
    fileName: string;
    size: number;
    type?: string;
};

/** Only the asset ID is returned; callers retrieve assets via the authenticated API route. */
export interface UploadWhiteboardAssetOutputDTO {
    assetId: string;
    uploadUrl: string;
    expiresAt: string;
}
