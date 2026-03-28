export interface SlicePlaneNormal {
    x: number;
    y: number;
    z: number;
};

export type SlicePlaneNormalAxis = keyof SlicePlaneNormal;

export interface SlicePlaneConfig {
    enabled: boolean;
    distance: number;
    normal: SlicePlaneNormal;
    reverseOrientation: boolean;
    visualizePlane: boolean;
};

export enum ParticleFilterSceneCombinator {
    And = 'AND',
    Or = 'OR'
};

export enum ParticleFilterSceneConditionKind {
    Property = 'property',
    Preset = 'preset'
};

export interface ParticleFilterPropertySceneCondition {
    kind: ParticleFilterSceneConditionKind.Property;
    property: string;
    operator: string;
    value: number;
    exposureId?: string;
};

export enum ParticleFilterSceneMode {
    Conditions = 'conditions',
    Preset = 'preset'
};

export enum ParticleFilterScenePreset {
    SurfaceAtoms = 'surface-atoms'
};

export enum SurfaceAtomsSceneCutoffMode {
    Auto = 'auto',
    Manual = 'manual'
};

export interface SurfaceAtomsScenePresetConfig {
    layers: number;
    cutoffMode: SurfaceAtomsSceneCutoffMode;
    cutoffRadius?: number;
    coordinationDeficit: number;
    anisotropyThreshold: number;
    byType: boolean;
};

export interface ParticleFilterPresetSceneCondition {
    kind: ParticleFilterSceneConditionKind.Preset;
    preset: ParticleFilterScenePreset.SurfaceAtoms;
    presetConfig: SurfaceAtomsScenePresetConfig;
};

export type ParticleFilterSceneCondition =
    | ParticleFilterPropertySceneCondition
    | ParticleFilterPresetSceneCondition;

export interface SceneRenderMetadata {
    exporter?: string;
    exportType?: string;
    defaultLineWidth?: number;
};

export interface SceneVisualOverride {
    opacity?: number;
    lineWidth?: number;
};

export type SceneVisualOverrides = Record<string, SceneVisualOverride>;

export type DefaultScene = {
    sceneType: string;
    source: 'default';
};

export type PluginScene = {
    sceneType: string;
    source: 'plugin';
    analysisId: string;
    exposureId: string;
    sceneRenderMetadata?: SceneRenderMetadata;
};

export type ColorCodingScene = {
    sceneType: string;
    source: 'color-coding';
    analysisId?: string;
    exposureId: string;
    property: string;
    startValue: string;
    endValue: string;
    gradient: string;
};

export type ParticleFilterScene = {
    sceneType: 'particle-filter';
    source: 'particle-filter';
    analysisId?: string;
    mode?: ParticleFilterSceneMode;
    combinator?: ParticleFilterSceneCombinator;
    conditions?: ParticleFilterSceneCondition[];
    exposureId?: string;
    property?: string;
    operator?: string;
    value?: number;
    preset?: ParticleFilterScenePreset;
    presetConfig?: SurfaceAtomsScenePresetConfig;
    action?: string;
};

export type SceneObjectType = DefaultScene | PluginScene | ColorCodingScene | ParticleFilterScene;
