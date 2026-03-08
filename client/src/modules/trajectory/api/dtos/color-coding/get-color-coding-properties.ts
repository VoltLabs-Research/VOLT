export interface GetColorCodingPropertiesInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
};

export interface ColorCodingProperties {
    base: string[];
    modifiers: Record<string, string[]>;
};
