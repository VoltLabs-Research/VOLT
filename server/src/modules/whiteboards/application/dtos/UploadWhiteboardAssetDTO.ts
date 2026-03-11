export interface UploadWhiteboardAssetInputDTO {
    teamId: string;
    whiteboardId: string;
    buffer: Buffer;
    mimetype: string;
    originalname: string;
};

/** Only the asset ID is returned; callers retrieve assets via the authenticated API route. */
export interface UploadWhiteboardAssetOutputDTO {
    assetId: string;
};
