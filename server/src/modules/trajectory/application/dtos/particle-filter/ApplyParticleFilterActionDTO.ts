import type {
    ParticleFilterCombinator,
    ParticleFilterConditionDTO,
    ParticleFilterMode,
    ParticleFilterPreset,
    SurfaceAtomsPresetConfigDTO
} from './PreviewParticleFilterDTO';

export interface ApplyParticleFilterActionInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    mode?: ParticleFilterMode;
    exposureId?: string;
    action: 'delete' | 'highlight';
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
    preset?: ParticleFilterPreset;
    presetConfig?: SurfaceAtomsPresetConfigDTO;
};

export interface ApplyParticleFilterActionOutputDTO {
    fileId: string;
    atomsResult: number;
    action: string;
};
