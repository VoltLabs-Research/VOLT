import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';

type PluginSceneDescriptor = {
    exposureId: string;
    exportType?: string;
};

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

export const isChartScene = (scene: SceneObjectType, pluginScenes: PluginSceneDescriptor[]) => {
    if (scene?.source !== 'plugin') return false;
    if (!('exposureId' in scene)) return false;
    const { exposureId } = scene;
    if (!exposureId) return false;

    return pluginScenes.some((pluginScene) => {
        return pluginScene.exposureId === exposureId && pluginScene.exportType === 'chart-png';
    });
};

export const getRenderableScenes = (scenes: SceneObjectType[], pluginScenes: PluginSceneDescriptor[], forceDefaultScene: boolean) => {
    if (forceDefaultScene) return [DEFAULT_SCENE];
    return scenes.filter((scene) => !isChartScene(scene, pluginScenes));
};
