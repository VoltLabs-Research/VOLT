import { create } from 'zustand';
import useTimestepStore from '@/stores/editor/timesteps';

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
    playNextFrame: () => void;
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
        if(intervalId){
            clearInterval(intervalId);
        }
        set({ isPlaying: false, intervalId: null });
    },

    togglePlay: () => {
        const { isPlaying } = get();

        if(isPlaying){
            get().stopPlayback();
        }else{
            const { timesteps } = useTimestepStore.getState().timestepData;
            if(!timesteps.length) return;

            set({ isPlaying: true });
            const newIntervalId = setInterval(() => {
                get().playNextFrame();
            }, 1000 / get().playSpeed);

            set({ intervalId: newIntervalId });
        }
    },

    setPlaySpeed: (speed: number) => {
        const clampedSpeed = Math.max(MIN_PLAY_SPEED, Math.min(MAX_PLAY_SPEED, speed));
        set({ playSpeed: clampedSpeed });

        if(get().isPlaying){
            get().stopPlayback();
            get().togglePlay();
        }
    },

    setCurrentTimestep: (timestep: number) => {
        get().stopPlayback();
        set({ currentTimestep: timestep });
    },

    playNextFrame: () => {
        const { currentTimestep } = get();
        const { timesteps } = useTimestepStore.getState().timestepData;

        if(!timesteps.length || currentTimestep === undefined){
            get().stopPlayback();
            return;
        }

        const currentIndex = timesteps.indexOf(currentTimestep);
        if(currentIndex === -1){
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
    }
});

export default usePlaybackStore;
