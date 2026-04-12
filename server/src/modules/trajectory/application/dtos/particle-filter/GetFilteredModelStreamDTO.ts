import type {
    ParticleFilterCombinator,
    ParticleFilterConditionDTO
} from './PreviewParticleFilterDTO';

import { Readable } from 'node:stream';

export interface GetFilteredModelStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property?: string;
    operator?: string;
    value?: string | number;
    action?: string;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
}

export interface GetFilteredModelStreamOutputDTO {
    stream: Readable;
}
