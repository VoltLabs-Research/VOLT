import { getSceneKey } from '@/modules/fractal/utils/scene-utils';

import type { EditorStore } from './types';

export const selectFractalSceneConfig = (state: EditorStore) => ({
    rendererCreate: state.rendererSettings.create,
    rendererRuntime: state.rendererSettings.runtime,
    camera: state.camera,
    orbitControls: state.orbitControls,
    grid: state.grid,
    environment: state.environment,
    effects: state.effects,
    lights: state.lights,
    pointCloudSettings: state.pointCloudSettings,
    pointSizeMultiplier: state.pointSizeMultiplier,
    dpr: state.performanceSettings.dpr,
    performance: state.performanceSettings.performance,
    adaptiveEventsEnabled: state.performanceSettings.adaptiveEvents.enabled,
    interactionDegradeEnabled: state.performanceSettings.interactionDegrade.enabled,
    activeScene: state.activeScene
});

export const selectSceneMergeGroupKeys = (state: EditorStore, sceneKey: string): string[] => {
    const groupId = state.sceneMergeGroups[sceneKey];
    if (!groupId) {
        return [];
    }

    return Object.keys(state.sceneMergeGroups).filter((key) => state.sceneMergeGroups[key] === groupId);
};

export const selectIsSceneMergeFollower = (state: EditorStore, sceneKey: string): boolean => {
    const groupId = state.sceneMergeGroups[sceneKey];
    if (!groupId) {
        return false;
    }

    const leaderKey = state.activeScenes
        .map(getSceneKey)
        .find((key) => state.sceneMergeGroups[key] === groupId);

    return leaderKey !== undefined && leaderKey !== sceneKey;
};

export const selectHasMergedScenes = (state: EditorStore): boolean =>
    Object.keys(state.sceneMergeGroups).length > 0;
