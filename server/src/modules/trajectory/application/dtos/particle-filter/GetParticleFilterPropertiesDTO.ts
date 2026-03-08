export interface GetParticleFilterPropertiesInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
};

export interface GetParticleFilterPropertiesOutputDTO {
    dump: string[];
    perAtom: Record<string, string[]>;
};
