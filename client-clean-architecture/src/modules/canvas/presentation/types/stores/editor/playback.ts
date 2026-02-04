export interface PlaybackState {
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep?: number;
    intervalId: ReturnType<typeof setInterval> | null;
    isPreloading?: boolean;
    didPreload?: boolean;
    preloadProgress?: number;
    downlinkMbps?: number | null;
};

export interface PlaybackActions {
    togglePlay: () => void;
    setPlaySpeed: (speed: number) => void;
    setCurrentTimestep: (timestep: number) => void;
    playNextFrame: () => void;
    stopPlayback: () => void;
    resetPlayback: () => void;
};

export type PlaybackStore = PlaybackState & PlaybackActions;
