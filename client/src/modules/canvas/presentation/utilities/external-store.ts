import { useSyncExternalStore } from 'react';

type Listener = () => void;

interface ExternalStore<T> {
    setState: (next: T | ((prev: T) => T)) => void;
    subscribe: (listener: Listener) => () => void;
    getSnapshot: () => T;
    getServerSnapshot?: () => T;
}

interface CreateExternalStoreOptions<T> {
    initialState: T;
    serverSnapshot?: T;
}

export const createExternalStore = <T>({ initialState, serverSnapshot }: CreateExternalStoreOptions<T>): ExternalStore<T> => {
    let state = initialState;
    const listeners = new Set<Listener>();

    const setState: ExternalStore<T>['setState'] = (next) => {
        const nextState = typeof next === 'function'
            ? (next as (prev: T) => T)(state)
            : next;
        if (Object.is(nextState, state)) return;
        state = nextState;
        listeners.forEach((listener) => listener());
    };

    const subscribe: ExternalStore<T>['subscribe'] = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    const getSnapshot = () => state;
    const getServerSnapshot = serverSnapshot !== undefined
        ? () => serverSnapshot
        : undefined;

    return {
        setState,
        subscribe,
        getSnapshot,
        getServerSnapshot
    };
};

export const useExternalStore = <T,>(store: ExternalStore<T>): T => {
    return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot ?? store.getSnapshot);
};
