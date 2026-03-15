export interface GetPreviewInputDTO {
    trajectoryId: string;
    frame?: number;
    quality?: 'low' | 'medium' | 'high';
};

export interface GetPreviewOutputDTO {
    blob: Blob;
};
