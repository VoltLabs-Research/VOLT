export interface GetColorCodingStatsInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property: string;
    type: string;
    exposureId?: string;
};

export interface ColorCodingStats {
    min: number;
    max: number;
};
