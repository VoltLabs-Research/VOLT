import { LandingScrollerContext } from '@/modules/marketing/hooks/use-scroll-progress';
import { useContext, useEffect, useState } from 'react';
import type { RefObject } from 'react';

// A screen's document loads a viewport ahead of it, and closes a viewport and a half past it:
// at most the screen in view and its neighbour stay open.
const AHEAD = '100% 0px';
const BEYOND = '150% 0px';

export interface ScreenPresence {
    isNear: boolean;
    isVisible: boolean;
}

const watch = (element: Element, root: Element | null, rootMargin: string, onChange: (isIntersecting: boolean) => void) => {
    const watcher = new IntersectionObserver((entries) => {
        onChange(entries.some((entry) => entry.isIntersecting));
    }, { root, rootMargin });
    watcher.observe(element);
    return () => watcher.disconnect();
};

// Where `target` stands against the landing's scroller: near enough for its screen to be
// open, and in view, where the screen plays. The observers are rooted at the scroller, whose
// clip a viewport-rooted observer's margins would never reach past.
export const useScreenPresence = (target: RefObject<HTMLElement | null>): ScreenPresence => {
    const scroller = useContext(LandingScrollerContext);
    const [presence, setPresence] = useState<ScreenPresence>({ isNear: false, isVisible: false });

    useEffect(() => {
        const element = target.current;
        if (!element) {
            return;
        }

        if (!('IntersectionObserver' in window)) {
            setPresence({ isNear: true, isVisible: true });
            return;
        }

        const root = scroller.current;
        const stops = [
            watch(element, root, AHEAD, (isIntersecting) => {
                if (isIntersecting) {
                    setPresence((current) => ({ ...current, isNear: true }));
                }
            }),
            watch(element, root, BEYOND, (isIntersecting) => {
                if (!isIntersecting) {
                    setPresence({ isNear: false, isVisible: false });
                }
            }),
            watch(element, root, '0px', (isVisible) => {
                setPresence((current) => ({ ...current, isVisible }));
            })
        ];

        return () => stops.forEach((stop) => stop());
    }, [target, scroller]);

    return presence;
};
