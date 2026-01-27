import type { StateCreator } from 'zustand';
import type { PlaybackState, PlaybackStore } from '@/types/stores/editor/playback';
import { PlaybackUseCase } from '@/modules/canvas/application/use-cases/PlaybackUseCase';
import type { IPlaybackRepository } from '@/modules/canvas/domain/repositories/IPlaybackRepository';
import { clamp } from '@/modules/canvas/domain/services/EasingService';

const DEFAULT_PLAY_SPEED = 1;
const MIN_PLAY_SPEED = 0.1;
const MAX_PLAY_SPEED = 10;

const initialState: PlaybackState = {
    isPlaying: false,
    playSpeed: DEFAULT_PLAY_SPEED,
    currentTimestep: undefined,
    intervalId: null,
} as PlaybackState & { isPreloading?: boolean; didPreload?: boolean; preloadProgress?: number };

let activePlaybackUseCase: PlaybackUseCase | null = null;

const createPlaybackRepository = (
    get: () => PlaybackStore & Record<string, any>,
    set: (state: Partial<PlaybackState>) => void
): IPlaybackRepository => ({
    getState: () => ({
        isPlaying: get().isPlaying,
        playSpeed: get().playSpeed,
        currentTimestep: get().currentTimestep
    }),
    setState: (state) => set(state as Partial<PlaybackState>),
    getTimesteps: () => get().timestepData?.timesteps || [],
    isModelLoading: () => get().isModelLoading || false
});

export const createPlaybackSlice: StateCreator<any, [], [], PlaybackStore> = (set, get) => ({
    ...initialState,
    isPreloading: false,
    didPreload: false,
    preloadProgress: 0,

    stopPlayback() {
        if (activePlaybackUseCase) {
            activePlaybackUseCase.stop();
            activePlaybackUseCase = null;
        }
        set({ isPlaying: false, intervalId: null });
    },

    togglePlay(ids = {}) {
        const { isPlaying, didPreload } = get();
        if (isPlaying) {
            get().stopPlayback();
        } else {
            const { timesteps } = get().timestepData;
            if (!timesteps.length) return;
            (async () => {
                if (!didPreload) {
                    set({ isPreloading: true, preloadProgress: 0 });
                    try {
                        const frameCount = timesteps.length;
                        const maxFramesToPreload = frameCount > 100 ? 100 : undefined;
                        const currentFrameIndex = get().currentTimestep !== undefined
                            ? timesteps.indexOf(get().currentTimestep!)
                            : 0;

                        await get().loadModels(
                            true,
                            (p: number, m: any) => {
                                const mbps = m?.bps != null ? (m.bps * 8) / 1_000_000 : null;
                                set({ preloadProgress: p, downlinkMbps: mbps });
                            },
                            maxFramesToPreload,
                            currentFrameIndex,
                            ids
                        );
                    } catch (err) { 
                        console.error('[PlaybackSlice] preloading failed', err);
                    } finally {
                        set({ isPreloading: false, didPreload: true });
                    }
                }

                const repository = createPlaybackRepository(get as any, set);
                activePlaybackUseCase = new PlaybackUseCase(repository);

                try {
                    for await (const _state of activePlaybackUseCase.execute()) {
                        if (!get().isPlaying) break;
                    }
                } finally {
                    activePlaybackUseCase = null;
                }
            })();
        }
    },

    setPlaySpeed(speed: number) {
        const clampedSpeed = clamp(speed, MIN_PLAY_SPEED, MAX_PLAY_SPEED);
        set({ playSpeed: clampedSpeed });
    },

    setCurrentTimestep(timestep: number) {
        set({ currentTimestep: timestep });
    },

    playNextFrame() {
        const { currentTimestep } = get();
        const { timesteps } = get().timestepData;

        if (!timesteps.length || currentTimestep === undefined) {
            get().stopPlayback();
            return;
        }

        const currentIndex = timesteps.indexOf(currentTimestep);
        if (currentIndex === -1) {
            get().stopPlayback();
            return;
        }

        const nextIndex = (currentIndex + 1) % timesteps.length;
        const nextTimestep = timesteps[nextIndex];

        set({ currentTimestep: nextTimestep });
    },

    resetPlayback() {
        get().stopPlayback();
        set({
            ...initialState,
            isPreloading: false,
            didPreload: false,
            preloadProgress: 0
        });
    }
});
