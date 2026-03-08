export interface GetParticleFilterUniqueValuesInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    maxValues?: number;
};

export interface GetParticleFilterUniqueValuesOutputDTO {
    values: number[];
};
