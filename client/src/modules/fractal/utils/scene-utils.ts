import { Exporter } from '@volt/contracts/modules/plugin/enums';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';

export interface SceneKeyConfig {
    source: string;
    sceneType: string;
    analysisId?: string;
    exposureId?: string;
}

export const getSceneKey = (sceneConfig: SceneKeyConfig) => {
    if (sceneConfig.source === 'plugin') {
        return `plugin-${sceneConfig.analysisId}-${sceneConfig.exposureId}`;
    }
    return `${sceneConfig.source}-${sceneConfig.sceneType}`;
};

export const DEFAULT_SCENE: SceneObjectType = {
    sceneType: 'trajectory',
    source: 'default'
};

const isChartScene = (scene: SceneObjectType) => {
    if (scene?.source !== 'plugin') return false;

    return scene.sceneRenderMetadata?.exportType === 'chart-png';
};

export const isMeshScene = (scene: SceneObjectType | null | undefined): boolean => {
    if (scene?.source !== 'plugin') return false;

    return scene.sceneRenderMetadata?.exporter === Exporter.MESH;
};

export const getRenderableScenes = (scenes: SceneObjectType[], forceDefaultScene: boolean) => {
    if (forceDefaultScene) return [DEFAULT_SCENE];
    return scenes.filter((scene) => !isChartScene(scene));
};
