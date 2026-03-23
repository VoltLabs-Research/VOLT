import { FilterExpression } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';

import { Readable } from 'node:stream';

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

export interface ParticleFilterPropertyCondition extends FilterExpression {
    kind: ParticleFilterConditionKind.Property;
    exposureId?: string;
};

export interface SurfaceAtomsPresetConfig {
    layers: number;
    cutoffMode: SurfaceAtomsCutoffMode;
    cutoffRadius?: number;
    coordinationDeficit: number;
    anisotropyThreshold: number;
    byType: boolean;
};

export interface ParticleFilterPresetCondition {
    kind: ParticleFilterConditionKind.Preset;
    preset: ParticleFilterPreset.SurfaceAtoms;
    presetConfig: SurfaceAtomsPresetConfig;
};

export type ParticleFilterCondition =
    | ParticleFilterPropertyCondition
    | ParticleFilterPresetCondition;

export interface ParticleFilterRequest {
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterCondition[];
};

export interface IParticleFilterService {
    getProperties(
        trajectoryId: string,
        timestep: string | number,
        analysisId?: string
    ): Promise<{ dump: string[]; perAtom: Record<string, string[]>; exposureNames: Record<string, string> }>;

    getUniqueValues(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        maxValues?: number,
        analysisId?: string,
        exposureId?: string
    ): Promise<number[]>;

    preview(
        trajectoryId: string,
        timestep: string | number,
        request: ParticleFilterRequest,
        analysisId?: string
    ): Promise<{ matchCount: number; totalAtoms: number }>;

    applyAction(
        trajectoryId: string,
        timestep: string | number,
        action: 'delete' | 'highlight',
        request: ParticleFilterRequest,
        analysisId?: string
    ): Promise<{ fileId: string; atomsResult: number; action: string }>;

    getModelStream(
        trajectoryId: string,
        timestep: string | number,
        request: ParticleFilterRequest,
        action?: string,
        analysisId?: string
    ): Promise<Readable>;
};
