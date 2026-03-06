export interface IRasterService {
    triggerRasterization(trajectoryId: string, teamId: string, config?: any): Promise<boolean>;
    getRasterMetadata(trajectoryId: string): Promise<RasterMetadata | null>;
    getRasterFramePNG(trajectoryId: string, timestep: number): Promise<Buffer>;
}

export interface RasterMetadata {
    trajectoryId: string;
    totalFrames: number;
    rasterizedFrames: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}
