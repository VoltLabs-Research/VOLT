export interface PlaybackState {
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep?: number;
    intervalId: ReturnType<typeof setInterval> | null;
    // Extended UI/support fields
    isPreloading?: boolean;
    didPreload?: boolean;
    preloadProgress?: number;
    downlinkMbps?: number | null;
}

export interface PlaybackActions {
    togglePlay: (ids?: { teamId?: string; trajectoryId?: string }) => void;
    setPlaySpeed: (speed: number) => void;
    setCurrentTimestep: (timestep: number) => void;
    playNextFrame: () => void;
    stopPlayback: () => void;
    resetPlayback: () => void;
}

export type PlaybackStore = PlaybackState & PlaybackActions;
