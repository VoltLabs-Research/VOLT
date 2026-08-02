import { preloadFractalSceneAsset } from '@/modules/fractal/api/service/preload-scene-asset';
import { useCanvasAccessStore } from '@/modules/canvas/api/access';
import { useTeamStore } from '@/modules/team/store/team/use-team-store';
import { isAbortError, reportError } from '@/shared/errors/core';

import type { EditorStore } from './types';
import type { TimestepStore } from '@/modules/fractal/contracts/editor/scene-types';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';
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
        let failedCount = 0;

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
                await preloadFractalSceneAsset(assetParams, { signal });
            } catch (error) {
                if (isAbortError(error)) return;
                failedCount++;
            }

            // Progress still advances on failure so the bar cannot stall, but the
            // failure is counted and reported rather than silently swallowed.
            if (signal?.aborted) return;

            loadedCount++;
            onProgress?.(loadedCount / total, { bps: 0 });
        });

        await Promise.all(promises);

        if (failedCount > 0 && !signal?.aborted) {
            reportError(
                new Error(`${failedCount} of ${total} frames could not be preloaded.`),
                { fallbackTitle: 'Some frames could not be preloaded' }
            );
        }

        return {};
    }
});
