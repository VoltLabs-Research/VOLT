import { useSyncExternalStore } from 'react';

const store = {
    isInteracting: false,
    listeners: new Set<() => void>()
};

const emit = () => {
    store.listeners.forEach((listener) => listener());
};

export const setSceneInteracting = (isInteracting: boolean) => {
    if (store.isInteracting === isInteracting) return;
    store.isInteracting = isInteracting;
    emit();
};

const subscribe = (listener: () => void) => {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
};

const getSnapshot = () => store.isInteracting;
const getServerSnapshot = () => false;
const useSceneInteraction = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export default useSceneInteraction;
