import type { EditorStore } from './types';

export const selectFractalSceneConfig = (state: EditorStore) => ({
    rendererCreate: state.rendererSettings.create,
    powerPreference: state.performanceSettings.canvas.powerPreference,
    rendererRuntime: state.rendererSettings.runtime,
    camera: state.camera,
    orbitControls: state.orbitControls,
    grid: state.grid,
    environment: state.environment,
    effects: state.effects,
    lights: state.lights,
    renderConfig: state.renderConfig,
    pointCloudSettings: {
        ...state.pointCloudSettings,
        pointSizeMultiplier: state.pointSizeMultiplier
    },
    slicePlaneConfig: state.configuration.slicePlaneConfig,
    dpr: state.performanceSettings.dpr,
    performance: state.performanceSettings.performance,
    adaptiveEventsEnabled: state.performanceSettings.adaptiveEvents.enabled,
    interactionDegradeEnabled: state.performanceSettings.interactionDegrade.enabled,
    activeScene: state.activeScene
});
