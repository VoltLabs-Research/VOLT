export interface SlicePlaneNormal {
    x: number;
    y: number;
    z: number;
}

export type SlicePlaneNormalAxis = keyof SlicePlaneNormal;

export interface SlicePlaneConfig {
    enabled: boolean;
    distance: number;
    normal: SlicePlaneNormal;
    reverseOrientation: boolean;
    visualizePlane: boolean;
}

export enum ParticleFilterSceneCombinator {
    And = 'AND',
    Or = 'OR'
}

export interface ParticleFilterPropertySceneCondition {
    kind?: 'property';
    property: string;
    operator: string;
    value: number | string;
    exposureId?: string;
}
export type ParticleFilterSceneCondition = ParticleFilterPropertySceneCondition;

export interface SceneRenderMetadata {
    exporter?: string;
    exportType?: string;
    defaultLineWidth?: number;
}

export interface SceneVisualOverride {
    opacity?: number;
    lineWidth?: number;
}

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
    combinator?: ParticleFilterSceneCombinator;
    conditions?: ParticleFilterSceneCondition[];
    exposureId?: string;
    property?: string;
    operator?: string;
    value?: number | string;
    action?: string;
};

export type SceneObjectType = DefaultScene | PluginScene | ColorCodingScene | ParticleFilterScene;
