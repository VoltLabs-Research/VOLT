import type { StateCreator } from 'zustand';
import type { PlaybackState, PlaybackStore } from '@/modules/fractal/types/stores/editor/scene-types';
import type { EditorStore } from './types';

const DEFAULT_PLAY_SPEED = 1;
const MIN_PLAY_SPEED = 0.1;
const MAX_PLAY_SPEED = 10;

const createInitialState = (): PlaybackState => ({
    isPlaying: false,
    playSpeed: DEFAULT_PLAY_SPEED,
    currentTimestep: undefined,
    isPreloading: false,
    didPreload: false,
    preloadProgress: 0,
    downlinkMbps: null
});

let _rafId: number | null = null;
let _lastFrameTime: number = 0;
let _playbackGeneration = 0;
let _preloadAbortController: AbortController | null = null;

const clearPlaybackFrame = () => {
    if (_rafId !== null) {
        cancelAnimationFrame(_rafId);
        _rafId = null;
    }

    _lastFrameTime = 0;
};

const cancelPreloading = () => {
    if (_preloadAbortController) {
        _preloadAbortController.abort();
        _preloadAbortController = null;
    }
};

const advancePlaybackGeneration = () => {
    _playbackGeneration += 1;
    return _playbackGeneration;
};

const isAbortError = (error: unknown) => {
    return error instanceof Error && error.name === 'AbortError';
};

export const createPlaybackSlice: StateCreator<EditorStore, [], [], PlaybackStore> = (set, get) => ({
    ...createInitialState(),

    stopPlayback() {
        clearPlaybackFrame();
        cancelPreloading();
        advancePlaybackGeneration();
        set({
            isPlaying: false,
            isPreloading: false,
            preloadProgress: 0,
            downlinkMbps: null
        });
    },

    togglePlay() {
        const { isPlaying, isPreloading, didPreload } = get();
        if (isPlaying || isPreloading) {
            get().stopPlayback();
        } else {
            const { timesteps } = get().timestepData;
            if (!timesteps.length) return;

            const playbackGeneration = advancePlaybackGeneration();

            (async () => {
                let shouldMarkPreloadComplete = didPreload;

                if (!didPreload) {
                    const preloadAbortController = new AbortController();
                    _preloadAbortController = preloadAbortController;
                    set({ isPreloading: true, preloadProgress: 0 });

                    try {
                        const frameCount = timesteps.length;
                        const maxFramesToPreload = frameCount > 100 ? 100 : undefined;
                        const currentFrameIndex = get().currentTimestep !== undefined
                            ? timesteps.indexOf(get().currentTimestep!)
                            : 0;

                        await get().loadModels(
                            true,
                            (progress: number, metrics?: { bps: number }) => {
                                if (_playbackGeneration !== playbackGeneration) {
                                    return;
                                }

                                const mbps = metrics?.bps != null ? (metrics.bps * 8) / 1_000_000 : null;
                                set({ preloadProgress: progress, downlinkMbps: mbps });
                            },
                            maxFramesToPreload,
                            currentFrameIndex,
                            preloadAbortController.signal
                        );
                        shouldMarkPreloadComplete = true;
                    } catch (error) {
                        if (isAbortError(error)) {
                            return;
                        }
                    } finally {
                        if (_preloadAbortController === preloadAbortController) {
                            _preloadAbortController = null;
                        }

                        if (_playbackGeneration !== playbackGeneration) {
                            return;
                        }

                        set({
                            isPreloading: false,
                            didPreload: shouldMarkPreloadComplete
                        });
                    }
                }

                if (_playbackGeneration !== playbackGeneration) {
                    return;
                }

                set({ isPlaying: true });

                if (get().currentTimestep === undefined) {
                    set({ currentTimestep: timesteps[0] });
                }

                _lastFrameTime = 0;

                const tick = (timestamp: number) => {
                    if (_playbackGeneration !== playbackGeneration) {
                        _rafId = null;
                        return;
                    }

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
        clearPlaybackFrame();
        cancelPreloading();
        advancePlaybackGeneration();
        set(createInitialState());
    }
});
