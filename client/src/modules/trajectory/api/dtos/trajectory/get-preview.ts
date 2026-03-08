export interface GetPreviewInputDTO {
    trajectoryId: string;
    version?: string;
    frame?: number;
    quality?: 'low' | 'medium' | 'high';
};

export interface GetPreviewOutputDTO {
    blob: Blob;
};
