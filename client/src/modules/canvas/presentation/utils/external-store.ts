import { useSyncExternalStore } from 'react';

type Listener = () => void;

interface ExternalStore<T> {
    subscribe: (listener: Listener) => () => void;
    getSnapshot: () => T;
    getServerSnapshot?: () => T;
    emit: () => void;
}

interface StoreConfig<T> {
    initialState: T;
    serverSnapshot?: T;
}

/**
 * Creates a simple external store for use with useSyncExternalStore.
 * Provides subscribe/emit/getSnapshot pattern that can be shared across components.
 */
export function createExternalStore<T>(config: StoreConfig<T>): ExternalStore<T> & { state: T; setState: (updater: T | ((prev: T) => T)) => void } {
    const listeners = new Set<Listener>();
    
    const store = {
        state: config.initialState,
        
        subscribe: (listener: Listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        
        getSnapshot: () => store.state,
        
        getServerSnapshot: config.serverSnapshot !== undefined 
            ? () => config.serverSnapshot! 
            : undefined,
        
        emit: () => {
            listeners.forEach((listener) => listener());
        },
        
        setState: (updater: T | ((prev: T) => T)) => {
            const nextState = typeof updater === 'function' 
                ? (updater as (prev: T) => T)(store.state)
                : updater;
            
            if (store.state !== nextState) {
                store.state = nextState;
                store.emit();
            }
        }
    };
    
    return store;
}

/**
 * Hook wrapper for external stores created with createExternalStore.
 */
export function useExternalStore<T>(store: ExternalStore<T>): T {
    return useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getServerSnapshot
    );
}
