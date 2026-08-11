import { useEditorStore } from '@/modules/canvas/store/editor';
import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_SCROLL_MARGIN = 40;

interface UseTimelineScrubberParams {
    rangedTimesteps: number[];
    currentTimestep: number | undefined;
    currentFrame: number;
}

const useTimelineScrubber = ({ rangedTimesteps, currentTimestep, currentFrame }: UseTimelineScrubberParams) => {
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);

    const rulerRef = useRef<HTMLDivElement>(null);
    const tickCentersRef = useRef<number[]>([]);
    const isDraggingRef = useRef(false);
    const touchPointerIdRef = useRef<number | null>(null);
    const pendingScrubRafRef = useRef<number | null>(null);
    const pendingScrubClientXRef = useRef<number | null>(null);
    const ignoreNextRulerClickRef = useRef(false);
    const [playheadLeft, setPlayheadLeft] = useState(0);

    const currentIndex = currentTimestep === undefined ? -1 : rangedTimesteps.indexOf(currentTimestep);

    const collectTickCenters = useCallback((): void => {
        const ruler = rulerRef.current;
        if (!ruler) {
            tickCentersRef.current = [];
            return;
        }

        tickCentersRef.current = Array.from(
            ruler.querySelectorAll<HTMLDivElement>('.canvas-ruler-tick'),
            (tick) => tick.offsetLeft + tick.offsetWidth / 2
        );
    }, []);

    const updatePlayheadPosition = useCallback(() => {
        const ruler = rulerRef.current;
        if (!ruler || rangedTimesteps.length === 0) return;
        if (tickCentersRef.current.length === 0) {
            collectTickCenters();
        }
        if (currentIndex < 0 || currentIndex >= tickCentersRef.current.length) return;

        const tickCenter = tickCentersRef.current[currentIndex];
        const scrollOffset = ruler.scrollLeft;
        setPlayheadLeft(tickCenter - scrollOffset);

        const isOffscreen = tickCenter < scrollOffset + AUTO_SCROLL_MARGIN
            || tickCenter > scrollOffset + ruler.clientWidth - AUTO_SCROLL_MARGIN;
        if (!isOffscreen) return;

        ruler.scrollTo({
            left: tickCenter - ruler.clientWidth / 2,
            behavior: isDraggingRef.current ? 'auto' : 'smooth'
        });
    }, [collectTickCenters, currentIndex, rangedTimesteps.length]);

    useEffect(() => {
        collectTickCenters();

        const ruler = rulerRef.current;
        if (!ruler) return;
        const resizeObserver = new ResizeObserver(() => collectTickCenters());
        resizeObserver.observe(ruler);
        return () => resizeObserver.disconnect();
    }, [collectTickCenters, rangedTimesteps]);

    useEffect(() => {
        updatePlayheadPosition();

        const ruler = rulerRef.current;
        if (!ruler) return;
        const handleScroll = () => updatePlayheadPosition();
        ruler.addEventListener('scroll', handleScroll);
        const resizeObserver = new ResizeObserver(() => updatePlayheadPosition());
        resizeObserver.observe(ruler);
        return () => {
            ruler.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }, [updatePlayheadPosition]);

    useEffect(() => () => {
        if (pendingScrubRafRef.current !== null) {
            window.cancelAnimationFrame(pendingScrubRafRef.current);
        }
    }, []);

    const applyScrubAtClientX = (clientX: number) => {
        const ruler = rulerRef.current;
        if (!ruler || rangedTimesteps.length === 0) return;
        if (tickCentersRef.current.length === 0) {
            collectTickCenters();
        }
        const centers = tickCentersRef.current;
        if (centers.length === 0) return;

        const localX = clientX - ruler.getBoundingClientRect().left + ruler.scrollLeft;

        let low = 0;
        let high = centers.length - 1;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (centers[middle] < localX) low = middle + 1;
            else high = middle;
        }

        const isPreviousCloser = low > 0 && Math.abs(centers[low - 1] - localX) <= Math.abs(centers[low] - localX);
        const nearestIndex = isPreviousCloser ? low - 1 : low;

        if (nearestIndex < rangedTimesteps.length) {
            setCurrentTimestep(rangedTimesteps[nearestIndex]);
        }
    };

    const scheduleScrub = (clientX: number) => {
        pendingScrubClientXRef.current = clientX;
        if (pendingScrubRafRef.current !== null) return;
        pendingScrubRafRef.current = window.requestAnimationFrame(() => {
            pendingScrubRafRef.current = null;
            const pending = pendingScrubClientXRef.current;
            pendingScrubClientXRef.current = null;
            if (pending !== null) applyScrubAtClientX(pending);
        });
    };

    const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
        isDraggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const rulerHandlers = {
        onClick: (event: React.MouseEvent<HTMLDivElement>) => {
            if (ignoreNextRulerClickRef.current) {
                ignoreNextRulerClickRef.current = false;
                event.preventDefault();
                return;
            }

            applyScrubAtClientX(event.clientX);
        },

        onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;

            const isTouch = event.pointerType === 'touch';
            touchPointerIdRef.current = isTouch ? event.pointerId : null;
            isDraggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            applyScrubAtClientX(event.clientX);
            if (isTouch) event.preventDefault();
        },

        onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
            if (touchPointerIdRef.current === event.pointerId) {
                event.preventDefault();
                scheduleScrub(event.clientX);
                return;
            }

            if (!isDraggingRef.current) return;
            scheduleScrub(event.clientX);
        },

        onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
            if (touchPointerIdRef.current === event.pointerId) {
                if (event.type === 'pointerleave') return;

                touchPointerIdRef.current = null;
                stopDragging(event);
                ignoreNextRulerClickRef.current = true;
                applyScrubAtClientX(event.clientX);
                event.preventDefault();
                return;
            }

            if (!isDraggingRef.current) return;
            stopDragging(event);
        },

        onWheel: (event: React.WheelEvent<HTMLDivElement>) => {
            const ruler = rulerRef.current;
            if (!ruler) return;
            ruler.scrollLeft += event.deltaY !== 0 ? event.deltaY : event.deltaX;
        },

        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (!rangedTimesteps.length) return;

            const frameIndex = Math.max(0, rangedTimesteps.indexOf(currentFrame));
            const lastIndex = rangedTimesteps.length - 1;
            const nextIndexByKey: Record<string, number | undefined> = {
                ArrowLeft: Math.max(0, frameIndex - 1),
                ArrowDown: Math.max(0, frameIndex - 1),
                ArrowRight: Math.min(lastIndex, frameIndex + 1),
                ArrowUp: Math.min(lastIndex, frameIndex + 1),
                Home: 0,
                End: lastIndex
            };
            const nextIndex = nextIndexByKey[event.key];

            if (nextIndex === undefined || nextIndex === frameIndex) return;

            event.preventDefault();
            setCurrentTimestep(rangedTimesteps[nextIndex]);
        }
    };

    return {
        rulerRef,
        playheadLeft,
        rulerHandlers
    };
};

export default useTimelineScrubber;
