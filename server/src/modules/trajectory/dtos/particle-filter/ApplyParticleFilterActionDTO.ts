import type {
    ParticleFilterCombinator,
    ParticleFilterConditionDTO
} from './PreviewParticleFilterDTO';

export interface ApplyParticleFilterActionInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    action: 'delete' | 'highlight';
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionDTO[];
}

export interface ApplyParticleFilterActionOutputDTO {
    fileId: string;
    atomsResult: number;
    action: string;
}
