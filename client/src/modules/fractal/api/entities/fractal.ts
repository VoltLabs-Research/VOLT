import type * as THREE from 'three';

export type SliceAxis = 'x' | 'y' | 'z';

export interface ModelWorldBounds {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
};

export interface SlicePlaneConfig {
    activeAxes: SliceAxis[];
    positions: Record<SliceAxis, number>;
    angles: Record<SliceAxis, number>;
    showHelper: boolean;
};

export interface BoxBounds {
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
};

export type Pos3D = {
    x: number;
    y: number;
    z: number;
};

export interface ModelLoadingState {
    isLoading: boolean;
    progress: number;
    error: string | null;
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
    exposureId?: string;
    property: string;
    operator: string;
    value: number;
    action?: string;
};

export type SceneObjectType = DefaultScene | PluginScene | ColorCodingScene | ParticleFilterScene;

export default interface IFractalAssetLoader {
    load(
        url: string,
        onProgress?: (progress: number) => void,
        signal?: AbortSignal
    ): Promise<THREE.Group>;
};
