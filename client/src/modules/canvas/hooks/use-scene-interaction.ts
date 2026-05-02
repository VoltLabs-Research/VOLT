import { create } from 'zustand';

interface SceneInteractionState {
    isInteracting: boolean;
    setSceneInteracting: (isInteracting: boolean) => void;
    resetSceneInteraction: () => void;
}

const useSceneInteractionStore = create<SceneInteractionState>((set) => ({
    isInteracting: false,
    setSceneInteracting: (isInteracting: boolean) => set({ isInteracting }),
    resetSceneInteraction: () => set({ isInteracting: false })
}));

export const setSceneInteracting = (isInteracting: boolean) => {
    useSceneInteractionStore.getState().setSceneInteracting(isInteracting);
};

export const resetSceneInteraction = () => {
    useSceneInteractionStore.getState().resetSceneInteraction();
};

const useSceneInteraction = () => useSceneInteractionStore((state) => state.isInteracting);

export default useSceneInteraction;
