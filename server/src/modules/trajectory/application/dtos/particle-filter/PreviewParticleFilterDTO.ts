export enum ParticleFilterCombinator {
    And = 'AND',
    Or = 'OR'
};

export interface ParticleFilterConditionDTO {
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number;
    exposureId?: string;
};

export interface PreviewParticleFilterInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
};

export interface PreviewParticleFilterOutputDTO {
    matchCount: number;
    totalAtoms: number;
};
