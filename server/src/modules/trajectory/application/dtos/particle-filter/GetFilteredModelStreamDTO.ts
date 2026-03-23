import type {
    ParticleFilterCombinator,
    ParticleFilterConditionDTO,
    ParticleFilterMode,
    ParticleFilterPreset,
    SurfaceAtomsPresetConfigDTO
} from './PreviewParticleFilterDTO';

import { Readable } from 'node:stream';

export interface GetFilteredModelStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    mode?: ParticleFilterMode;
    exposureId?: string;
    property?: string;
    operator?: string;
    value?: string | number;
    action?: string;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
    preset?: ParticleFilterPreset;
    presetConfig?: SurfaceAtomsPresetConfigDTO;
};

export interface GetFilteredModelStreamOutputDTO {
    stream: Readable;
};
