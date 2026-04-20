import { preloadFractalSceneAsset } from '@/modules/fractal/api/service/preload-scene-asset';
import { useCanvasAccessStore } from '@/modules/canvas/api/access';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';

import type { EditorStore } from './types';
import type { TimestepStore, SceneObjectType } from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { StateCreator } from 'zustand';

const getAnalysisIdFromScene = (scene: SceneObjectType): string => {
    if ('analysisId' in scene && scene.analysisId) {
        return scene.analysisId;
    }
    return 'default';
};

export const createTimestepSlice: StateCreator<EditorStore, [], [], TimestepStore> = (_set, get) => ({
    loadModels: async ({ trajectoryId, timesteps, onProgress, maxFramesToPreload, currentFrameIndex, signal }) => {
        if (!timesteps.length) {
            return {};
        }

        const teamId = useTeamStore.getState().selectedTeamId;
        const activeScene = get().activeScene;
        const analysisId = getAnalysisIdFromScene(activeScene);

        if (!teamId) {
            return {};
        }

        const startIndex = currentFrameIndex ?? 0;
        const limit = maxFramesToPreload || timesteps.length;
        const endIndex = Math.min(startIndex + limit, timesteps.length);

        const targetTimesteps = timesteps.slice(startIndex, endIndex);
        const total = targetTimesteps.length;

        if (!total || signal?.aborted) {
            return {};
        }

        let loadedCount = 0;

        const promises = targetTimesteps.map(async (timestep: number) => {
            if (signal?.aborted) {
                return;
            }

            const assetParams = {
                teamId,
                trajectoryId,
                currentTimestep: timestep,
                analysisId,
                activeScene: activeScene as SceneObjectType,
                mode: useCanvasAccessStore.getState().mode
            };

            try {
                if (signal?.aborted) {
                    return;
                }

                await preloadFractalSceneAsset(assetParams, { signal });
            } catch {
            } finally {
                if (signal?.aborted) {
                    return;
                }

                loadedCount++;
                if (onProgress) {
                    onProgress(loadedCount / total, { bps: 0 });
                }
            }
        });

        await Promise.all(promises);
        return {};
    }
});
