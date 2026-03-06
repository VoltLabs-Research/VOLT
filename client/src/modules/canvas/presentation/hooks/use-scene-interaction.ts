import { createExternalStore, useExternalStore } from '../utilities/external-store';

const store = createExternalStore({ initialState: false, serverSnapshot: false });

export const setSceneInteracting = (isInteracting: boolean) => {
    store.setState(isInteracting);
};

export const resetSceneInteraction = () => {
    store.setState(false);
};

const useSceneInteraction = () => useExternalStore(store);

export default useSceneInteraction;
