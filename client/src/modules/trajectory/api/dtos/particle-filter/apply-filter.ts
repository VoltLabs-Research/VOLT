import type {
    ParticleFilterCombinator,
    ParticleFilterConditionDTO
} from './preview-filter';

export type FilterAction = 'delete' | 'highlight';

export interface ApplyFilterInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number;
    exposureId?: string;
    action: FilterAction;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
};

export interface ApplyFilterOutputDTO {
    fileId: string;
    atomsResult: number;
    action: string;
};
