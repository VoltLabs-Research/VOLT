export enum ParticleFilterCombinator {
    And = 'AND',
    Or = 'OR'
};

export interface ParticleFilterConditionDTO {
    kind?: 'property';
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number;
    exposureId?: string;
};

export interface PreviewFilterInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number;
    exposureId?: string;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
};

export interface PreviewFilterOutputDTO {
    matchCount: number;
    totalAtoms: number;
};
