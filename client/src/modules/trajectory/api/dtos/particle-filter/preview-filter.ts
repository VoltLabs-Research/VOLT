export enum ParticleFilterCombinator {
    And = 'AND',
    Or = 'OR'
};

export enum ParticleFilterMode {
    Conditions = 'conditions',
    Preset = 'preset'
};

export enum ParticleFilterConditionKind {
    Property = 'property',
    Preset = 'preset'
};

export enum ParticleFilterPreset {
    SurfaceAtoms = 'surface-atoms'
};

export enum SurfaceAtomsCutoffMode {
    Auto = 'auto',
    Manual = 'manual'
};

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

export interface PreviewFilterInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    mode?: ParticleFilterMode;
    property?: string;
    operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value?: number;
    exposureId?: string;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
    preset?: ParticleFilterPreset;
    presetConfig?: SurfaceAtomsPresetConfigDTO;
};

export interface PreviewFilterOutputDTO {
    matchCount: number;
    totalAtoms: number;
};
