import type {
    ParticleFilterCombinator,
    ParticleFilterConditionDTO,
    ParticleFilterMode,
    ParticleFilterPreset,
    SurfaceAtomsPresetConfigDTO
} from './preview-filter';

export type FilterAction = 'delete' | 'highlight';

export interface ApplyFilterInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    mode?: ParticleFilterMode;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number;
    exposureId?: string;
    action: FilterAction;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
    preset?: ParticleFilterPreset;
    presetConfig?: SurfaceAtomsPresetConfigDTO;
};

export interface ApplyFilterOutputDTO {
    fileId: string;
    atomsResult: number;
    action: string;
};
