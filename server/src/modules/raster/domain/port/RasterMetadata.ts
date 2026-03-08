export interface RasterMetadata {
    trajectoryId: string;
    totalFrames: number;
    rasterizedFrames: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}
