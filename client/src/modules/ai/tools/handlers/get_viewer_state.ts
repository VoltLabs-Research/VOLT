import { useEditorStore } from '@/modules/canvas/store/editor';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';

import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';

const getViewerState: ClientToolHandler = {
    name: 'get_viewer_state',
    needsViewer: true,

    run(_input, ctx): ClientToolResult {
        const bridge = ctx.getCanvasBridge();
        const state = useEditorStore.getState();

        const activeScene = state.activeScene;
        const activeSceneKey = activeScene ? getSceneKey(activeScene) : null;

        const snapshot = {
            trajectoryId: bridge.trajectoryId,
            frameCount: bridge.timesteps.length,
            currentTimestep: state.currentTimestep ?? bridge.currentTimestep ?? null,
            isPlaying: state.isPlaying,
            playSpeed: state.playSpeed,
            activeSceneId: activeSceneKey ?? bridge.activeSceneId,
            activeSceneType: activeScene?.sceneType ?? null,
            activeSceneSource: activeScene?.source ?? null,
            activeSceneCount: state.activeScenes.length,
            pointSizeMultiplier: state.pointSizeMultiplier,
            backgroundColor: state.environment.backgroundColor,
            gridEnabled: state.grid.enabled,
            fogEnabled: state.environment.enableFog,
            showSimulationCell: state.showSimulationCell,
            qualityPreset: state.performanceSettings.preset,
            activeSidebarOption: state.configuration.activeSidebarOption || null
        };

        return {
            ok: true,
            summary: bridge.trajectoryId
                ? `Viewer is on frame ${snapshot.currentTimestep ?? '—'} of ${snapshot.frameCount}, ${state.isPlaying ? 'playing' : 'paused'}.`
                : 'Viewer is open but no trajectory is loaded.',
            data: snapshot
        };
    },

    describeEffect() {
        return { label: 'Read viewer state', icon: 'eye' };
    }
};

export default getViewerState;
