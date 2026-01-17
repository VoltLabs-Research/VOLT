export interface TriggerRasterizationInputDTO {
    trajectoryId: string;
    config?: any;
}

export interface TriggerRasterizationOutputDTO {
    message: string;
    trajectoryId: string;
    triggered: boolean;
}

export interface GetRasterMetadataOutputDTO {
    metadata: {
        trajectoryId: string;
        totalFrames: number;
        rasterizedFrames: number;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    } | null;
}

export interface GetRasterFramePNGInputDTO {
    trajectoryId: string;
    timestep: number;
}
