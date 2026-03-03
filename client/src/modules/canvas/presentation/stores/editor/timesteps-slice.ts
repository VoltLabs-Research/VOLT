import type { StateCreator } from 'zustand';
import type { Trajectory } from '@/modules/trajectory/domain/entities';
import type { TimestepData, TimestepState, TimestepStore } from '@/modules/fractal/presentation/types/stores/editor/scene-types';
import type { ActiveScene } from '@/modules/fractal/core/glb-url';

const initialTimestepData: TimestepData = {
    timesteps: [],
    minTimestep: 0,
    maxTimestep: 0,
    timestepCount: 0
};

const initialState: TimestepState = {
    timestepData: initialTimestepData,
    isRenderOptionsLoading: false
};

const extractTimestepsWorker = (frames: any[]): number[] => {
    if (!frames || frames.length === 0) return [];
    return Array.from(new Set(frames.map((frame: any) => frame.timestep)))
        .sort((a: number, b: number) => a - b);
};

const createTimestepData = (timesteps: number[]): TimestepData => ({
    timesteps,
    minTimestep: timesteps[0] || 0,
    maxTimestep: timesteps[timesteps.length - 1] || 0,
    timestepCount: timesteps.length,
});

export const createTimestepSlice: StateCreator<any, [], [], TimestepStore> = (set, get) => ({
    ...initialState,

    async computeTimestepData(trajectory: Trajectory | null, _currentTimestep?: number, _cacheBuster?: number) {
        if (!trajectory?.frames || trajectory.frames.length === 0) {
            set({ timestepData: initialTimestepData });
            return;
        }

        const timesteps = extractTimestepsWorker(trajectory.frames);
        const timestepData = createTimestepData(timesteps);

        set({ timestepData });
    },

    loadModels: async (_preloadBehavior, onProgress, maxFramesToPreload, currentFrameIndex) => {
        const { timestepData } = get();
        if (!timestepData.timesteps.length) return {};

        const { useTeamStore } = await import('@/modules/team/presentation/stores/use-team-store');
        const { default: useTrajectoryStore } = await import('@/modules/trajectory/presentation/stores/use-trajectory-store');
        const { AssetLoader } = await import('@/modules/fractal/core/AssetLoader');
        const { computeGlbUrl } = await import('@/modules/fractal/core/glb-url');
        const { useEditorStore } = await import('@/modules/canvas/presentation/stores/editor');

        const teamId = useTeamStore.getState().selectedTeam?._id;
        const trajectoryId = useTrajectoryStore.getState().trajectory?._id;
        const editorState = useEditorStore.getState();
        const activeScene = editorState.activeScene;
        const analysisId = (activeScene as any)?.analysisId || 'default';

        if (!teamId || !trajectoryId) return {};

        const timesteps = timestepData.timesteps;
        const startIndex = currentFrameIndex || 0;
        const limit = maxFramesToPreload || timesteps.length;
        const endIndex = Math.min(startIndex + limit, timesteps.length);

        const targetTimesteps = timesteps.slice(startIndex, endIndex);
        const total = targetTimesteps.length;
        let loadedCount = 0;

        const promises = targetTimesteps.map(async (timestep: number) => {
            const url = computeGlbUrl({
                teamId,
                trajectoryId,
                currentTimestep: timestep,
                analysisId,
                activeScene: activeScene as ActiveScene
            });
            if (!url) return;

            try {
                const loader = new AssetLoader();
                await loader.load(url);
            } catch {
            } finally {
                loadedCount++;
                if (onProgress) {
                    onProgress(loadedCount / total, { bps: 0 });
                }
            }
        });

        await Promise.all(promises);
        return {};
    },

    resetTimesteps() {
        set(initialState);
    }
});
