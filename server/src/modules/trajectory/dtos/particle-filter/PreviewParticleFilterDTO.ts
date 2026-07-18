import { ParticleFilterCombinator } from '@modules/trajectory/ports/particle-filter/IParticleFilterService';

export { ParticleFilterCombinator };

export interface ParticleFilterConditionDTO {
    kind?: 'property';
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number | string;
    exposureId?: string;
}

export interface PreviewParticleFilterInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionDTO[];
}

export interface PreviewParticleFilterOutputDTO {
    matchCount: number;
    totalAtoms: number;
}
