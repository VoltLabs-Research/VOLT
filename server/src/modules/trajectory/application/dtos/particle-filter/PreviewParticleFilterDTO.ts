export interface PreviewParticleFilterInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number;
}

export interface PreviewParticleFilterOutputDTO {
    matchCount: number;
    totalAtoms: number;
}
