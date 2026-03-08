export interface RasterMetadata {
    trajectoryId: string;
    totalFrames: number;
    rasterizedFrames: number;
    status: RasterMetadataStatus;
    createdAt: Date;
    updatedAt: Date;
};

export enum RasterMetadataStatus {
    Pending = 'pending',
    Processing = 'processing',
    Completed = 'completed',
    Failed = 'failed'
};
