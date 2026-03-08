export interface ApplyParticleFilterActionInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    action: 'delete' | 'highlight';
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number;
};

export interface ApplyParticleFilterActionOutputDTO {
    fileId: string;
    atomsResult: number;
    action: string;
};
