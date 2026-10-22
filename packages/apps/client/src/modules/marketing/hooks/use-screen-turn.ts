import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface Waiting {
    id: symbol;
    isVisible: boolean;
}

// The screens waiting to boot, and the one booting: it keeps its turn until it lets go.
let waiting: Waiting[] = [];
let booting: symbol | null = null;
const listeners = new Set<() => void>();

const pass = () => {
    if (!waiting.some((entry) => entry.id === booting)) {
        // The one in view goes before those ahead of it.
        booting = (waiting.find((entry) => entry.isVisible) ?? waiting[0])?.id ?? null;
    }
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

// Each screen is a whole app starting up, in the page's own process, so they boot one at a
// time: several at once, as when the page jumps to a section, starve the page of its
// connections and its main thread. A screen waits while `isWaiting`, and boots on its turn.
export const useScreenTurn = (isWaiting: boolean, isVisible: boolean): boolean => {
    const [id] = useState(() => Symbol('landing screen'));
    const visibility = useRef(isVisible);
    visibility.current = isVisible;

    useEffect(() => {
        if (!isWaiting) {
            return;
        }

        waiting = [...waiting, { id, isVisible: visibility.current }];
        pass();
        return () => {
            waiting = waiting.filter((entry) => entry.id !== id);
            pass();
        };
    }, [id, isWaiting]);

    useEffect(() => {
        waiting = waiting.map((entry) => (entry.id === id ? { id, isVisible } : entry));
        pass();
    }, [id, isVisible]);

    return useSyncExternalStore(subscribe, () => booting === id);
};
