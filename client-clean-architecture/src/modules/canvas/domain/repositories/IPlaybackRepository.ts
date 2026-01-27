/**
 * Playback state for repository operations.
 */
export interface PlaybackState {
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep: number | undefined;
}

/**
 * Repository interface for playback state management.
 */
export interface IPlaybackRepository {
    /**
     * Gets the current playback state.
     */
    getState(): PlaybackState;

    /**
     * Updates the playback state.
     */
    setState(state: Partial<PlaybackState>): void;

    /**
     * Gets available timesteps.
     */
    getTimesteps(): number[];

    /**
     * Checks if model is currently loading.
     */
    isModelLoading(): boolean;
}
