import { create } from 'zustand';

interface PlaybackState {
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep?: number;
    intervalId: ReturnType<typeof setInterval> | null;
}

interface PlaybackActions {
    togglePlay: () => void;
    setPlaySpeed: (speed: number) => void;
    setCurrentTimestep: (timestep: number) => void;
    playNextFrame: (timesteps: number[]) => void;
    stopPlayback: () => void;
    reset: () => void;
}

export type PlaybackStore = PlaybackState & PlaybackActions;

const DEFAULT_PLAY_SPEED = 1;
const MIN_PLAY_SPEED = 0.1;
const MAX_PLAY_SPEED = 5;

const initialState: PlaybackState = {
    isPlaying: false,
    playSpeed: DEFAULT_PLAY_SPEED,
    currentTimestep: undefined,
    intervalId: null,
};

const usePlaybackStore = create<PlaybackStore>()((set, get) => ({
        ...initialState,

        stopPlayback: () => {
            const { intervalId } = get();
            if (intervalId) {
                clearInterval(intervalId);
            }
            set({ isPlaying: false, intervalId: null });
        },

        togglePlay: () => {
            const { isPlaying, playSpeed } = get();
            
            if (isPlaying) {
                get().stopPlayback();
            } else {
                set({ isPlaying: true });
                
                const newIntervalId = setInterval(() => {
                    // Note: This requires timesteps to be passed from parent component
                    // or we need to subscribe to trajectory store
                    const timesteps: number[] = []; // This would come from trajectory store
                    get().playNextFrame(timesteps);
                }, 1000 / playSpeed);
                
                set({ intervalId: newIntervalId });
            }
        },

        setPlaySpeed: (speed: number) => {
            const clampedSpeed = Math.max(MIN_PLAY_SPEED, Math.min(MAX_PLAY_SPEED, speed));
            set({ playSpeed: clampedSpeed });
            
            // Restart playback with new speed if currently playing
            if (get().isPlaying) {
                get().stopPlayback();
                get().togglePlay();
            }
        },

        setCurrentTimestep: (timestep: number) => {
            get().stopPlayback();
            set({ currentTimestep: timestep });
        },

        playNextFrame: (timesteps: number[]) => {
            const { currentTimestep } = get();
            
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

        reset: () => {
            get().stopPlayback();
            set(initialState);
        },
    }),
);

export default usePlaybackStore;
