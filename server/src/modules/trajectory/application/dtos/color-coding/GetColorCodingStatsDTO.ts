export interface GetColorCodingStatsInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    type: string;
}

export interface GetColorCodingStatsOutputDTO {
    min: number;
    max: number;
}
