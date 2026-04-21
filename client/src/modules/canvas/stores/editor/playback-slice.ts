import { resolveRangedTimesteps } from '@/modules/canvas/utilities/timeline-range';

import type { EditorStore } from './types';
import type { PlaybackState, PlaybackStore, PlaybackTimelineParams } from '@/modules/fractal/stores/contracts/editor/scene-types';
import type { StateCreator } from 'zustand';

type PlaybackSliceSet = Parameters<StateCreator<EditorStore, [], [], PlaybackStore>>[0];
type PlaybackSliceGet = Parameters<StateCreator<EditorStore, [], [], PlaybackStore>>[1];

const DEFAULT_PLAY_SPEED = 1;
const MIN_PLAY_SPEED = 0.1;
const MAX_PLAY_SPEED = 10;
// Why: when the trajectory metadata does not expose a target FPS, default to
// 30 — the baseline documented in OPTIMIZATION_PLAN §F1.S4 acceptance for the
// 1M-atoms playback scenario.
const DEFAULT_TARGET_FPS = 30;

// Why: `preloadAbortController` cannot live inside zustand state — it is not a
// serializable value and Zustand's shallow-equal selector would churn. A single
// module-level controller is fine because only one playback session can be
// active per tab.
let _preloadAbortController: AbortController | null = null;

interface PlaybackRuntime {
    generation: number;
    lastFrameTime: number;
    timesteps: number[];
}

const createInitialRuntime = (): PlaybackRuntime => ({
    generation: 0,
    lastFrameTime: 0,
    timesteps: []
});

let _runtime: PlaybackRuntime = createInitialRuntime();

const createInitialState = (): PlaybackState => ({
    isPlaying: false,
    playSpeed: DEFAULT_PLAY_SPEED,
    currentTimestep: undefined,
    isPreloading: false,
    didPreload: false,
    preloadProgress: 0,
    downlinkMbps: null,
    rangeStart: undefined,
    rangeEnd: undefined,
    targetFps: DEFAULT_TARGET_FPS
});

const cancelPreloading = () => {
    if (_preloadAbortController) {
        _preloadAbortController.abort();
        _preloadAbortController = null;
    }
};

const advancePlaybackGeneration = (): number => {
    _runtime.generation += 1;
    _runtime.lastFrameTime = 0;
    return _runtime.generation;
};

const isAbortError = (error: unknown): boolean => {
    return error instanceof Error && error.name === 'AbortError';
};

const updateCurrentTimestep = (timestep: number, set: PlaybackSliceSet, get: PlaybackSliceGet) => {
    if (get().currentTimestep === timestep) {
        return;
    }

    set({ currentTimestep: timestep });
    get().clearTimestepScopedScenes();
};

const resolveFrameDelayMs = (playSpeed: number, targetFps: number): number => {
    const effectiveFps = playSpeed * targetFps;
    if (effectiveFps <= 0) {
        return Number.POSITIVE_INFINITY;
    }

    return 1000 / effectiveFps;
};

export const createPlaybackSlice: StateCreator<EditorStore, [], [], PlaybackStore> = (set, get) => ({
    ...createInitialState(),

    stopPlayback() {
        cancelPreloading();
        advancePlaybackGeneration();
        _runtime.timesteps = [];
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
            return;
        }

        const rangedTimesteps = resolveRangedTimesteps(timesteps, get().rangeStart, get().rangeEnd);
        if (!rangedTimesteps.length) return;

        const playbackGeneration = advancePlaybackGeneration();
        _runtime.timesteps = timesteps;

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
                            if (_runtime.generation !== playbackGeneration) {
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

                    if (_runtime.generation !== playbackGeneration) {
                        return;
                    }

                    set({
                        isPreloading: false,
                        didPreload: shouldMarkPreloadComplete
                    });
                }
            }

            if (_runtime.generation !== playbackGeneration) {
                return;
            }

            _runtime.lastFrameTime = 0;
            set({ isPlaying: true });

            if (get().currentTimestep === undefined) {
                const ranged = resolveRangedTimesteps(timesteps, get().rangeStart, get().rangeEnd);
                if (ranged.length) {
                    updateCurrentTimestep(ranged[0], set, get);
                }
            }
        })();
    },

    /**
     * Drives the playback clock from the R3F `useFrame` callback.
     *
     * Called every rendered frame with the high-resolution clock reading. The
     * slice no longer schedules its own `requestAnimationFrame` — the Canvas
     * already pumps a single rAF loop under `frameloop="demand"`, and this
     * method reuses it so playback is naturally frame-demand aware (playback
     * stops advancing when the tab is hidden or the canvas is paused).
     */
    tick(now: number) {
        const state = get();
        if (!state.isPlaying) {
            return;
        }

        if (_runtime.timesteps.length === 0) {
            return;
        }

        if (state.isModelLoading) {
            _runtime.lastFrameTime = 0;
            return;
        }

        if (_runtime.lastFrameTime === 0) {
            _runtime.lastFrameTime = now;
            return;
        }

        const elapsed = now - _runtime.lastFrameTime;
        const frameDelay = resolveFrameDelayMs(state.playSpeed, state.targetFps);
        if (elapsed < frameDelay) {
            return;
        }

        _runtime.lastFrameTime = now;

        const ranged = resolveRangedTimesteps(_runtime.timesteps, state.rangeStart, state.rangeEnd);
        if (!ranged.length) {
            state.stopPlayback();
            return;
        }

        if (state.currentTimestep === undefined) {
            updateCurrentTimestep(ranged[0], set, get);
            return;
        }

        const index = ranged.indexOf(state.currentTimestep);
        if (index === -1) {
            updateCurrentTimestep(ranged[0], set, get);
            return;
        }

        const nextIndex = (index + 1) % ranged.length;
        updateCurrentTimestep(ranged[nextIndex], set, get);
    },

    setPlaySpeed(speed: number) {
        const clampedSpeed = Math.max(MIN_PLAY_SPEED, Math.min(MAX_PLAY_SPEED, speed));
        set({ playSpeed: clampedSpeed });
    },

    setTargetFps(fps: number) {
        if (!Number.isFinite(fps) || fps <= 0) {
            return;
        }

        set({ targetFps: fps });
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
        cancelPreloading();
        advancePlaybackGeneration();
        _runtime = createInitialRuntime();
        set(createInitialState());
    }
});
