export interface PreviewFilterInputDTO{
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number;
    exposureId?: string;
}

export interface PreviewFilterOutputDTO{
    matchCount: number;
    totalAtoms: number;
}