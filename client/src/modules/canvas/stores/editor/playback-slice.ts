import type { EditorStore } from './types';
import type { PlaybackState, PlaybackStore } from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { StateCreator } from 'zustand';

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
    downlinkMbps: null,
    rangeStart: undefined,
    rangeEnd: undefined
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
            const rangedTimesteps = get().getRangedTimesteps();
            if (!rangedTimesteps.length) return;

            const { timesteps: allTimesteps } = get().timestepData;
            const playbackGeneration = advancePlaybackGeneration();

            (async () => {
                let shouldMarkPreloadComplete = didPreload;

                if (!didPreload) {
                    const preloadAbortController = new AbortController();
                    _preloadAbortController = preloadAbortController;
                    set({ isPreloading: true, preloadProgress: 0 });

                    try {
                        const frameCount = allTimesteps.length;
                        const maxFramesToPreload = frameCount > 100 ? 100 : undefined;
                        const currentFrameIndex = get().currentTimestep !== undefined
                            ? allTimesteps.indexOf(get().currentTimestep!)
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
                    const rangedTs = get().getRangedTimesteps();
                    if (rangedTs.length) {
                        set({ currentTimestep: rangedTs[0] });
                    }
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
                        const ts = get().getRangedTimesteps();

                        if (!ts.length) {
                            get().stopPlayback();
                            return;
                        }

                        if (currentTimestep === undefined) {
                            set({ currentTimestep: ts[0] });
                        } else {
                            const index = ts.indexOf(currentTimestep);
                            if (index === -1) {
                                set({ currentTimestep: ts[0] });
                            } else {
                                const nextIndex = (index + 1) % ts.length;
                                set({ currentTimestep: ts[nextIndex] });
                            }
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
        const timesteps = get().getRangedTimesteps();

        if (!timesteps.length || currentTimestep === undefined) {
            get().stopPlayback();
            return;
        }

        const currentIndex = timesteps.indexOf(currentTimestep);
        if (currentIndex === -1) {
            set({ currentTimestep: timesteps[0] });
            return;
        }

        const nextIndex = (currentIndex + 1) % timesteps.length;
        set({ currentTimestep: timesteps[nextIndex] });
    },

    /**
     * Sets the start boundary of the playback range.
     * Clamps to not exceed `rangeEnd` and adjusts `currentTimestep` if it falls outside.
     *
     * @param value - The new range start value, or `undefined` to clear.
     */
    setRangeStart(value: number | undefined) {
        const { rangeEnd, currentTimestep } = get();
        let clamped = value;
        if (clamped !== undefined && rangeEnd !== undefined) {
            clamped = Math.min(clamped, rangeEnd);
        }

        const updates: Partial<PlaybackState> = { rangeStart: clamped };
        if (clamped !== undefined && currentTimestep !== undefined) {
            const effectiveEnd = rangeEnd ?? Infinity;
            if (currentTimestep < clamped) {
                updates.currentTimestep = clamped;
            } else if (currentTimestep > effectiveEnd) {
                updates.currentTimestep = effectiveEnd;
            }
        }

        set(updates);
    },

    /**
     * Sets the end boundary of the playback range.
     * Clamps to not be below `rangeStart` and adjusts `currentTimestep` if it falls outside.
     *
     * @param value - The new range end value, or `undefined` to clear.
     */
    setRangeEnd(value: number | undefined) {
        const { rangeStart, currentTimestep } = get();
        let clamped = value;
        if (clamped !== undefined && rangeStart !== undefined) {
            clamped = Math.max(clamped, rangeStart);
        }

        const updates: Partial<PlaybackState> = { rangeEnd: clamped };
        if (clamped !== undefined && currentTimestep !== undefined) {
            const effectiveStart = rangeStart ?? -Infinity;
            if (currentTimestep > clamped) {
                updates.currentTimestep = clamped;
            } else if (currentTimestep < effectiveStart) {
                updates.currentTimestep = effectiveStart;
            }
        }

        set(updates);
    },

    /**
     * Returns the subset of timesteps within the current range boundaries.
     * If no range is set, returns all timesteps.
     */
    getRangedTimesteps() {
        const { timestepData, rangeStart, rangeEnd } = get();
        const ts = timestepData.timesteps;
        if (!ts.length) return ts;
        const start = rangeStart ?? ts[0];
        const end = rangeEnd ?? ts[ts.length - 1];
        return ts.filter((t) => t >= start && t <= end);
    },

    resetPlayback() {
        clearPlaybackFrame();
        cancelPreloading();
        advancePlaybackGeneration();
        set(createInitialState());
    }
});
