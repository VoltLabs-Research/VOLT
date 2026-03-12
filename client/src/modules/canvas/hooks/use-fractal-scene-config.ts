import { useEditorStore } from '@/modules/canvas/stores/editor';
import { selectFractalSceneConfig } from '@/modules/canvas/stores/editor/selectors';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';

const useFractalSceneConfig = (): FractalSceneConfig => {
    const selected = useEditorStore(useShallow(selectFractalSceneConfig));

    return useMemo<FractalSceneConfig>(() => ({
        rendererCreate: selected.rendererCreate,
        rendererRuntime: selected.rendererRuntime,
        camera: selected.camera,
        orbitControls: selected.orbitControls,
        grid: selected.grid,
        environment: selected.environment,
        effects: selected.effects,
        lights: selected.lights,
        pointCloudSettings: {
            ...selected.pointCloudSettings,
            pointSizeMultiplier: selected.pointSizeMultiplier
        },
        slicePlaneConfig: selected.slicePlaneConfig,
        dpr: selected.dpr,
        performance: selected.performance,
        adaptiveEventsEnabled: selected.adaptiveEventsEnabled,
        interactionDegradeEnabled: selected.interactionDegradeEnabled,
        activeScene: selected.activeScene
    }), [selected]);
};

export default useFractalSceneConfig;
