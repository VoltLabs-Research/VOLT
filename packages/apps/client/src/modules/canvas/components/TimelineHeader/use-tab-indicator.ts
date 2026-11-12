import { useEffect, useLayoutEffect, useState } from 'react';

import type { CSSProperties, RefObject } from 'react';

interface IndicatorPlacement {
    left: number;
    width: number;
}

// The pill under the open tab slides to the next one instead of jumping, and with no tab open it fades where it was.
// It lands in place without sliding the first time, so it never sweeps in from the edge.
const useTabIndicator = (tablistRef: RefObject<HTMLElement | null>, activeTab: string | null): CSSProperties => {
    const [placement, setPlacement] = useState<IndicatorPlacement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [animates, setAnimates] = useState(false);

    useLayoutEffect(() => {
        const tablist = tablistRef.current;
        if (!tablist) return;
        const measure = () => {
            const active = tablist.querySelector<HTMLElement>('[data-timeline-tab-active]');
            setIsVisible(Boolean(active));
            if (active) setPlacement({ left: active.offsetLeft, width: active.offsetWidth });
        };
        measure();
        // A tab's label can change width (the outputs tab names the open output), and fonts load late.
        const observer = new ResizeObserver(measure);
        observer.observe(tablist);
        return () => observer.disconnect();
    }, [tablistRef, activeTab]);

    useEffect(() => {
        if (!placement || animates) return;
        const frame = window.requestAnimationFrame(() => setAnimates(true));
        return () => window.cancelAnimationFrame(frame);
    }, [placement, animates]);

    return {
        width: placement?.width ?? 0,
        transform: `translateX(${placement?.left ?? 0}px)`,
        opacity: isVisible ? 1 : 0,
        transition: animates ? undefined : 'none'
    };
};

export default useTabIndicator;
