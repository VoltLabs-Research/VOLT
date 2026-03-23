import {
    ParticleFilterCombinator,
    ParticleFilterConditionKind,
    ParticleFilterMode,
    ParticleFilterPreset,
    SurfaceAtomsCutoffMode
} from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';

export { ParticleFilterCombinator, ParticleFilterConditionKind, ParticleFilterMode, ParticleFilterPreset, SurfaceAtomsCutoffMode };

export interface ParticleFilterPropertyConditionDTO {
    kind: ParticleFilterConditionKind.Property;
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number;
    exposureId?: string;
};

export interface SurfaceAtomsPresetConfigDTO {
    layers: number;
    cutoffMode: SurfaceAtomsCutoffMode;
    cutoffRadius?: number;
    coordinationDeficit: number;
    anisotropyThreshold: number;
    byType: boolean;
};

export interface ParticleFilterPresetConditionDTO {
    kind: ParticleFilterConditionKind.Preset;
    preset: ParticleFilterPreset.SurfaceAtoms;
    presetConfig: SurfaceAtomsPresetConfigDTO;
};

export type ParticleFilterConditionDTO =
    | ParticleFilterPropertyConditionDTO
    | ParticleFilterPresetConditionDTO;

export interface PreviewParticleFilterInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    mode?: ParticleFilterMode;
    exposureId?: string;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
    preset?: ParticleFilterPreset;
    presetConfig?: SurfaceAtomsPresetConfigDTO;
};

export interface PreviewParticleFilterOutputDTO {
    matchCount: number;
    totalAtoms: number;
};
