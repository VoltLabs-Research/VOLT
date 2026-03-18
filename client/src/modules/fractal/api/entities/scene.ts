export enum SliceAxis {
    X = 'x',
    Y = 'y',
    Z = 'z'
};

export interface SlicePlaneConfig {
    activeAxes: SliceAxis[];
    positions: Record<SliceAxis, number>;
    angles: Record<SliceAxis, number>;
    showHelper: boolean;
};

export enum ParticleFilterSceneCombinator {
    And = 'AND',
    Or = 'OR'
};

export interface ParticleFilterSceneCondition {
    property: string;
    operator: string;
    value: number;
    exposureId?: string;
};

export type DefaultScene = {
    sceneType: string;
    source: 'default';
};

export type PluginScene = {
    sceneType: string;
    source: 'plugin';
    analysisId: string;
    exposureId: string;
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
    value?: number;
    action?: string;
};

export type SceneObjectType = DefaultScene | PluginScene | ColorCodingScene | ParticleFilterScene;
