import type { StateCreator } from 'zustand';
import type { PlaybackState, PlaybackStore } from '@/modules/fractal/presentation/types/stores/editor/scene-types';

const DEFAULT_PLAY_SPEED = 1;
const MIN_PLAY_SPEED = 0.1;
const MAX_PLAY_SPEED = 10;

const initialState: PlaybackState = {
    isPlaying: false,
    playSpeed: DEFAULT_PLAY_SPEED,
    currentTimestep: undefined,
} as PlaybackState & { isPreloading?: boolean; didPreload?: boolean; preloadProgress?: number };

let _rafId: number | null = null;
let _lastFrameTime: number = 0;

export const createPlaybackSlice: StateCreator<any, [], [], PlaybackStore> = (set, get) => ({
    ...initialState,
    isPreloading: false,
    didPreload: false,
    preloadProgress: 0,

    stopPlayback() {
        if (_rafId !== null) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }
        set({ isPlaying: false });
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

                set({ isPlaying: true });

                if (get().currentTimestep === undefined) {
                    set({ currentTimestep: timesteps[0] });
                }

                _lastFrameTime = 0;

                const tick = (timestamp: number) => {
                    if (!get().isPlaying) {
                        _rafId = null;
                        return;
                    }

                    if (get().isModelLoading) {
                        _lastFrameTime = 0;
                        _rafId = requestAnimationFrame(tick);
                        return;
                    }

                    if (_lastFrameTime === 0) {
                        _lastFrameTime = timestamp;
                        _rafId = requestAnimationFrame(tick);
                        return;
                    }

                    const elapsed = timestamp - _lastFrameTime;
                    const frameDelay = 1000 / get().playSpeed;

                    if (elapsed >= frameDelay) {
                        _lastFrameTime = timestamp;

                        const { currentTimestep } = get();
                        const { timesteps: ts } = get().timestepData;

                        if (currentTimestep === undefined) {
                            set({ currentTimestep: ts[0] });
                        } else {
                            const index = ts.indexOf(currentTimestep);
                            if (index === -1) {
                                get().stopPlayback();
                                return;
                            }
                            const nextIndex = (index + 1) % ts.length;
                            set({ currentTimestep: ts[nextIndex] });
                        }
                    }

                    _rafId = requestAnimationFrame(tick);
                };

                _rafId = requestAnimationFrame(tick);
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
        if (_rafId !== null) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }
        get().stopPlayback();
        set({
            ...initialState,
            isPreloading: false,
            didPreload: false,
            preloadProgress: 0
        });
    }
});
