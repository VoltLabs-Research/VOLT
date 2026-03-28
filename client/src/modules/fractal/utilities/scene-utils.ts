import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';

interface SceneKeyConfig {
    source: string;
    sceneType: string;
    analysisId?: string;
    exposureId?: string;
};

export const getSceneKey = (sceneConfig: SceneKeyConfig) => {
    if (sceneConfig.source === 'plugin') {
        return `plugin-${sceneConfig.analysisId}-${sceneConfig.exposureId}`;
    }
    return `${sceneConfig.source}-${sceneConfig.sceneType}`;
};

export const DEFAULT_SCENE: SceneObjectType = { sceneType: 'trajectory', source: 'default' };

export const isChartScene = (scene: SceneObjectType) => {
    if (scene?.source !== 'plugin') return false;

    return scene.sceneRenderMetadata?.exportType === 'chart-png';
};

export const getRenderableScenes = (scenes: SceneObjectType[], forceDefaultScene: boolean) => {
    if (forceDefaultScene) return [DEFAULT_SCENE];
    return scenes.filter((scene) => !isChartScene(scene));
};
