import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

export const useFocusOnActivate = <T extends HTMLElement>(active: boolean): RefObject<T | null> => {
    const container = useRef<T>(null);
    const wasActive = useRef(active);

    useLayoutEffect(() => {
        if (wasActive.current === active) {
            return;
        }

        wasActive.current = active;

        if (active) {
            container.current?.querySelector<HTMLElement>('a, button')?.focus();
        }
    }, [active]);

    return container;
};
