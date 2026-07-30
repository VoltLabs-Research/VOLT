import { Exporter } from '@volt/contracts/modules/plugin/enums';

import type { LineStyleSpec, SceneObjectType } from '@/modules/fractal/contracts/scene';

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

export const getRenderableScenes = (scenes: SceneObjectType[], forceDefaultScene: boolean) => {
    if (forceDefaultScene) return [DEFAULT_SCENE];
    return scenes.filter((scene) => !isChartScene(scene));
};

interface LineSceneSource {
    scene: SceneObjectType;
    analysisId: string;
    exposureId: string;
    style?: LineStyleSpec;
}

export const resolveLineSceneSource = (scene: SceneObjectType): LineSceneSource | null => {
    if (scene.source === 'plugin' && scene.sceneRenderMetadata?.exporter === Exporter.LINE) {
        return {
            scene,
            analysisId: scene.analysisId,
            exposureId: scene.exposureId
        };
    }
    if (scene.source === 'line-style') {
        return {
            scene,
            analysisId: scene.analysisId,
            exposureId: scene.exposureId,
            style: scene.style
        };
    }
    return null;
};
