import type { StateCreator } from 'zustand';
import type { PlaybackState, PlaybackStore } from '@/types/stores/editor/playback';

const DEFAULT_PLAY_SPEED = 1;
const MIN_PLAY_SPEED = 0.1;
const MAX_PLAY_SPEED = 5;

const initialState: PlaybackState = {
    isPlaying: false,
    playSpeed: DEFAULT_PLAY_SPEED,
    currentTimestep: undefined,
    intervalId: null,
} as PlaybackState & { isPreloading?: boolean; didPreload?: boolean; preloadProgress?: number };

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const createPlaybackSlice: StateCreator<any, [], [], PlaybackStore> = (set, get) => ({
    ...initialState,
    isPreloading: false,
    didPreload: false,
    preloadProgress: 0,

    stopPlayback() {
        set({ isPlaying: false, intervalId: null });
    },

    togglePlay() {
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
                            currentFrameIndex
                        );
                    } catch { } finally {
                        set({ isPreloading: false, didPreload: true });
                    }
                }

                set({ isPlaying: true, intervalId: null });

                while (get().isPlaying) {
                    const { currentTimestep } = get();

                    if (currentTimestep === undefined) {
                        set({ currentTimestep: timesteps[0] });
                        while (get().isModelLoading && get().isPlaying) {
                            await delay(50);
                        }
                        const frameDelay = 1000 / get().playSpeed;
                        await delay(frameDelay);
                        continue;
                    }

                    const index = timesteps.indexOf(currentTimestep);
                    if (index === -1) {
                        get().stopPlayback();
                        return;
                    }

                    const nextIndex = (index + 1) % timesteps.length;
                    const nextTimestep = timesteps[nextIndex];
                    set({ currentTimestep: nextTimestep });

                    while (get().isModelLoading && get().isPlaying) {
                        await delay(50);
                    }

                    const frameDelay = 1000 / get().playSpeed;
                    await delay(frameDelay);
                }
            })();
        }
    },

    setPlaySpeed(speed: number) {
        const clampedSpeed = Math.max(MIN_PLAY_SPEED, Math.min(MAX_PLAY_SPEED, speed));
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
