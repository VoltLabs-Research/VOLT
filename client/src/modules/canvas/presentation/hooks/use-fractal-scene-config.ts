import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { selectFractalSceneConfig } from '@/modules/canvas/presentation/stores/editor/selectors';
import type { FractalSceneConfig } from '@/modules/fractal/presentation/types/scene-config';

const useFractalSceneConfig = (): FractalSceneConfig => {
    const selected = useEditorStore(useShallow(selectFractalSceneConfig));

    return useMemo<FractalSceneConfig>(() => ({
        rendererCreate: {
            ...selected.rendererCreate,
            powerPreference: selected.powerPreference
        },
        rendererRuntime: selected.rendererRuntime,
        camera: selected.camera,
        orbitControls: selected.orbitControls,
        grid: selected.grid,
        environment: selected.environment,
        effects: selected.effects,
        lights: selected.lights,
        renderConfig: selected.renderConfig,
        slicePlaneConfig: selected.slicePlaneConfig,
        dpr: selected.dpr,
        performance: selected.performance,
        adaptiveEventsEnabled: selected.adaptiveEventsEnabled,
        interactionDegradeEnabled: selected.interactionDegradeEnabled,
        activeScene: selected.activeScene
    }), [selected]);
};

export default useFractalSceneConfig;
