import type { EditorStore } from '@/modules/fractal/presentation/stores/editor';
import type { FractalSceneConfig } from '@/modules/fractal/presentation/types/scene-config';

export const selectFractalSceneConfig = (state: EditorStore): FractalSceneConfig => ({
    rendererCreate: {
        ...state.rendererSettings.create,
        powerPreference: state.performanceSettings.canvas.powerPreference
    },
    rendererRuntime: state.rendererSettings.runtime,
    camera: state.camera,
    orbitControls: state.orbitControls,
    grid: state.grid,
    environment: state.environment,
    effects: state.effects,
    lights: state.lights,
    renderConfig: state.renderConfig,
    slicePlaneConfig: state.configuration.slicePlaneConfig,
    dpr: state.performanceSettings.dpr,
    performance: state.performanceSettings.performance,
    adaptiveEventsEnabled: state.performanceSettings.adaptiveEvents.enabled,
    interactionDegradeEnabled: state.performanceSettings.interactionDegrade.enabled,
    activeScene: state.activeScene
});

export const selectFractalSceneConfigSignature = (state: EditorStore): string => [
    state.rendererSettings.create,
    state.performanceSettings.canvas.powerPreference,
    state.rendererSettings.runtime,
    state.camera,
    state.orbitControls,
    state.grid,
    state.environment,
    state.effects,
    state.lights,
    state.renderConfig,
    state.configuration.slicePlaneConfig,
    state.performanceSettings.dpr,
    state.performanceSettings.performance,
    state.performanceSettings.adaptiveEvents.enabled,
    state.performanceSettings.interactionDegrade.enabled,
    state.activeScene
].map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join('|');
