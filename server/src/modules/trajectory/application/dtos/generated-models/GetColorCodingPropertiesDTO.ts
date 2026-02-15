export interface GetColorCodingPropertiesInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
}

export interface GetColorCodingPropertiesOutputDTO {
    base: string[];
    modifiers: Record<string, string[]>;
}