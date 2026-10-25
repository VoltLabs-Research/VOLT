import { Exporter } from '@volt/contracts/modules/plugin/enums';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import {
    DEFAULT_LINE_WIDTH,
    buildPluginScene,
    buildSceneRenderMetadata,
    resolvePluginSceneRenderMetadata
} from '../../utils/plugin-exposure-export';

import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';

export interface ExposureScene {
    scene: SceneObjectType;
    sceneKey: string;
    isLine: boolean;
    isMesh: boolean;
    defaultLineWidth: number;
}

// The scene an exposure renders as: from its own export settings, else from what its plugin declares.
export const resolveExposureScene = (
    exposure: RenderableExposure,
    pluginId: string,
    pluginsById: Record<string, Plugin>
): ExposureScene => {
    const sceneRenderMetadata = buildSceneRenderMetadata(exposure.export)
        ?? resolvePluginSceneRenderMetadata(pluginsById[pluginId], exposure.exposureId);
    const scene = buildPluginScene({
        analysisId: exposure.analysisId,
        exposureId: exposure.exposureId,
        sceneRenderMetadata
    });

    return {
        scene,
        sceneKey: getSceneKey(scene),
        isLine: sceneRenderMetadata?.exporter === Exporter.LINE,
        isMesh: sceneRenderMetadata?.exporter === Exporter.MESH,
        defaultLineWidth: sceneRenderMetadata?.defaultLineWidth ?? DEFAULT_LINE_WIDTH
    };
};
