import { resolveRangedTimesteps } from '@/modules/canvas/utilities/timeline-range';

import type { EditorStore } from './types';
import type { PlaybackState, PlaybackStore, PlaybackTimelineParams } from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { StateCreator } from 'zustand';

type PlaybackSliceSet = Parameters<StateCreator<EditorStore, [], [], PlaybackStore>>[0];
type PlaybackSliceGet = Parameters<StateCreator<EditorStore, [], [], PlaybackStore>>[1];

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

const updateCurrentTimestep = (timestep: number, set: PlaybackSliceSet, get: PlaybackSliceGet) => {
    if (get().currentTimestep === timestep) {
        return;
    }

    set({ currentTimestep: timestep });
    get().clearTimestepScopedScenes();
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

    togglePlay({ trajectoryId, timesteps }: PlaybackTimelineParams) {
        const { isPlaying, isPreloading, didPreload } = get();
        if (isPlaying || isPreloading) {
            get().stopPlayback();
        } else {
            const rangedTimesteps = resolveRangedTimesteps(timesteps, get().rangeStart, get().rangeEnd);
            if (!rangedTimesteps.length) return;

            const playbackGeneration = advancePlaybackGeneration();

            (async () => {
                let shouldMarkPreloadComplete = didPreload;

                if (!didPreload) {
                    if (!trajectoryId) {
                        return;
                    }

                    const preloadAbortController = new AbortController();
                    _preloadAbortController = preloadAbortController;
                    set({ isPreloading: true, preloadProgress: 0 });

                    try {
                        const frameCount = timesteps.length;
                        const maxFramesToPreload = frameCount > 100 ? 100 : undefined;
                        const currentFrameIndex = get().currentTimestep !== undefined
                            ? timesteps.indexOf(get().currentTimestep!)
                            : 0;

                        await get().loadModels({
                            trajectoryId,
                            timesteps,
                            onProgress: (progress: number, metrics?: { bps: number }) => {
                                if (_playbackGeneration !== playbackGeneration) {
                                    return;
                                }

                                const mbps = metrics?.bps != null ? (metrics.bps * 8) / 1_000_000 : null;
                                set({ preloadProgress: progress, downlinkMbps: mbps });
                            },
                            maxFramesToPreload,
                            currentFrameIndex,
                            signal: preloadAbortController.signal
                        });
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
                    const rangedTs = resolveRangedTimesteps(timesteps, get().rangeStart, get().rangeEnd);
                    if (rangedTs.length) {
                        updateCurrentTimestep(rangedTs[0], set, get);
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
                        const ts = resolveRangedTimesteps(timesteps, get().rangeStart, get().rangeEnd);

                        if (!ts.length) {
                            get().stopPlayback();
                            return;
                        }

                        if (currentTimestep === undefined) {
                            updateCurrentTimestep(ts[0], set, get);
                        } else {
                            const index = ts.indexOf(currentTimestep);
                            if (index === -1) {
                                updateCurrentTimestep(ts[0], set, get);
                            } else {
                                const nextIndex = (index + 1) % ts.length;
                                updateCurrentTimestep(ts[nextIndex], set, get);
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
        updateCurrentTimestep(timestep, set, get);
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
                set({ rangeStart: clamped });
                updateCurrentTimestep(clamped, set, get);
                return;
            } else if (currentTimestep > effectiveEnd) {
                set({ rangeStart: clamped });
                updateCurrentTimestep(effectiveEnd, set, get);
                return;
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
                set({ rangeEnd: clamped });
                updateCurrentTimestep(clamped, set, get);
                return;
            } else if (currentTimestep < effectiveStart) {
                set({ rangeEnd: clamped });
                updateCurrentTimestep(effectiveStart, set, get);
                return;
            }
        }

        set(updates);
    },

    resetPlayback() {
        clearPlaybackFrame();
        cancelPreloading();
        advancePlaybackGeneration();
        set(createInitialState());
    }
});
