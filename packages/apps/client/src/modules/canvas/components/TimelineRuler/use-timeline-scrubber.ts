import { useEditorStore } from '@/modules/canvas/store/editor';
import { useEffect, useRef, useState } from 'react';

import type { KeyboardEvent, PointerEvent, RefObject } from 'react';

interface UseTimelineScrubberParams {
    trackRef: RefObject<HTMLDivElement | null>;
    rangedTimesteps: number[];
    currentFrame: number | undefined;
}

// The ruler spans the whole range, so a pointer's share of the track's width is its share of the frames.
export const indexAtClientX = (track: HTMLElement, clientX: number, count: number): number => {
    const box = track.getBoundingClientRect();
    const fraction = box.width > 0 ? Math.min(1, Math.max(0, (clientX - box.left) / box.width)) : 0;
    return Math.round(fraction * (count - 1));
};

const useTimelineScrubber = ({ trackRef, rangedTimesteps, currentFrame }: UseTimelineScrubberParams) => {
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);

    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const pendingScrubRafRef = useRef<number | null>(null);
    const pendingScrubClientXRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (pendingScrubRafRef.current !== null) {
            window.cancelAnimationFrame(pendingScrubRafRef.current);
        }
    }, []);

    const scrubAtClientX = (clientX: number) => {
        const track = trackRef.current;
        if (!track || rangedTimesteps.length === 0) return;
        setCurrentTimestep(rangedTimesteps[indexAtClientX(track, clientX, rangedTimesteps.length)]);
    };

    const scheduleScrub = (clientX: number) => {
        pendingScrubClientXRef.current = clientX;
        if (pendingScrubRafRef.current !== null) return;
        pendingScrubRafRef.current = window.requestAnimationFrame(() => {
            pendingScrubRafRef.current = null;
            const pending = pendingScrubClientXRef.current;
            pendingScrubClientXRef.current = null;
            if (pending !== null) scrubAtClientX(pending);
        });
    };

    const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const rulerHandlers = {
        onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;
            isDraggingRef.current = true;
            setIsDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            scrubAtClientX(event.clientX);
        },

        onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
            if (isDraggingRef.current) scheduleScrub(event.clientX);
        },

        onPointerUp: stopDragging,
        onPointerCancel: stopDragging,

        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            if (!rangedTimesteps.length || currentFrame === undefined) return;

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
        isDragging,
        rulerHandlers
    };
};

export default useTimelineScrubber;
