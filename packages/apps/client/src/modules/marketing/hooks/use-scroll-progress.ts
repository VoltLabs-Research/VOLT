import { useMotionValueEvent, useScroll } from 'framer-motion';
import { createContext, useContext, useState } from 'react';
import type { MotionValue } from 'framer-motion';
import type { RefObject } from 'react';

type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>['offset'];

// The landing scrolls itself (see .landing in landing.css), so scroll-linked motion
// measures against it rather than the window.
export const LandingScrollerContext = createContext<RefObject<HTMLElement | null>>({ current: null });

// How far the page has scrolled through `target`: 0 to 1 between the two edges of `offset`.
export const useScrollProgress = (target: RefObject<HTMLElement | null>, offset?: ScrollOffset): MotionValue<number> => {
    const container = useContext(LandingScrollerContext);
    return useScroll({ container, target, offset }).scrollYProgress;
};

export const useScrolledPast = (pixels: number): boolean => {
    const container = useContext(LandingScrollerContext);
    const { scrollY } = useScroll({ container });
    const [isPast, setPast] = useState(false);
    useMotionValueEvent(scrollY, 'change', (y) => setPast(y > pixels));
    return isPast;
};
