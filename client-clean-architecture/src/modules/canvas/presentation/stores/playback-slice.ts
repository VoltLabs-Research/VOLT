import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import { PlaybackUseCase } from '../../application/use-cases/PlaybackUseCase';
import type { IPlaybackRepository } from '../../domain/repositories/IPlaybackRepository';
import { clamp } from '../../domain/services/EasingService';

export interface PlaybackState {
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep: number | undefined;
    isPreloading: boolean;
    didPreload: boolean;
    preloadProgress: number;
}

export interface PlaybackActions {
    stopPlayback: () => void;
    togglePlay: () => void;
    setPlaySpeed: (speed: number) => void;
    setCurrentTimestep: (timestep: number) => void;
    resetPlayback: () => void;
}

export type PlaybackSlice = PlaybackState & PlaybackActions;

export const initialState: PlaybackState = {
    isPlaying: false,
    playSpeed: 1,
    currentTimestep: undefined,
    isPreloading: false,
    didPreload: false,
    preloadProgress: 0
};

/** Min/max play speed bounds */
const MIN_PLAY_SPEED = 0.1;
const MAX_PLAY_SPEED = 10;

/** Active playback use case instance (for stopping) */
let activePlaybackUseCase: PlaybackUseCase | null = null;

/**
 * Creates a playback repository adapter from the store state.
 */
const createPlaybackRepository = (
    get: () => PlaybackSlice & Record<string, any>,
    set: (state: Partial<PlaybackSlice>) => void
): IPlaybackRepository => ({
    getState: () => ({
        isPlaying: get().isPlaying,
        playSpeed: get().playSpeed,
        currentTimestep: get().currentTimestep
    }),
    setState: (state) => set(state as Partial<PlaybackSlice>),
    getTimesteps: () => {
        const fullState = get() as any;
        return fullState.timestepData?.timesteps || [];
    },
    isModelLoading: () => {
        const fullState = get() as any;
        return fullState.isModelLoading || false;
    }
});

export const createPlaybackSlice: SliceCreator<PlaybackSlice> = (set, get) => ({
    ...initialState,

    stopPlayback: () => {
        // Stop the active use case if running
        if (activePlaybackUseCase) {
            activePlaybackUseCase.stop();
            activePlaybackUseCase = null;
        }
        set({ isPlaying: false });
    },

    togglePlay: () => {
        const { isPlaying, stopPlayback } = get();

        if (isPlaying) {
            stopPlayback();
            return;
        }

        // Create repository adapter
        const repository = createPlaybackRepository(
            get as () => PlaybackSlice & Record<string, any>,
            set
        );

        // Check if we have timesteps
        if (repository.getTimesteps().length === 0) {
            return;
        }

        // Create and execute use case
        activePlaybackUseCase = new PlaybackUseCase(repository);

        // Execute playback asynchronously
        (async () => {
            try {
                for await (const _state of activePlaybackUseCase!.execute()) {
                    // State updates are handled by the repository
                    if (!get().isPlaying) break;
                }
            } finally {
                activePlaybackUseCase = null;
            }
        })();
    },

    setPlaySpeed: (speed) => {
        set({ playSpeed: clamp(speed, MIN_PLAY_SPEED, MAX_PLAY_SPEED) });
    },

    setCurrentTimestep: (timestep) => {
        set({ currentTimestep: timestep });
    },

    resetPlayback: () => {
        get().stopPlayback();
        set(initialState);
    }
});
