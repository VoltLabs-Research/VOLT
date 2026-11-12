import useTimelineScrubber, { indexAtClientX } from './use-timeline-scrubber';
import { labelledIndices } from '@/modules/canvas/utils/timeline-ruler';

import { cn } from '@heroui/react';
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TimelineTickTone } from '@/modules/canvas/utils/analysis-status-selectors';
import type { CSSProperties, PointerEvent } from 'react';

export interface TimelineRulerTick {
    frame: number;
    tone?: TimelineTickTone;
    dimmed?: boolean;
    // Cached by the preload Play runs; side by side, cached frames read as one loaded range.
    cached?: boolean;
}

// Unlabelled while the trajectory loads, so the ruler never shows timesteps it does not have.
const PLACEHOLDER_TICKS: TimelineRulerTick[] = Array.from({ length: 50 }, (_, index) => ({ frame: index }));
// A text-2xs digit is about 7px; labels keep 28px between them.
const LABEL_DIGIT_WIDTH = 7;
const LABEL_GAP = 28;
// Closer than this many px, only labelled frames keep a tick: a phone's ruler fits 105 frames 2.7px apart.
const MIN_TICK_SPACING = 2;
// The hover capsule hides while it would overlap the thumb, plus this margin.
const HOVER_THUMB_MARGIN = 4;
// A label hides while the thumb or the hover capsule is closer than this.
const LABEL_CLEARANCE = 6;

const LABEL_TONE_CLASS = {
    queued: 'text-warning-soft-foreground',
    running: 'text-info-soft-foreground',
    completed: 'text-success-soft-foreground'
} as const;

const MARK_TONE_CLASS = {
    queued: 'bg-warning',
    running: 'bg-info',
    completed: 'bg-success'
} as const;

const fractionOf = (index: number, count: number) => (count > 1 ? index / (count - 1) : 0.5);
const percentOf = (index: number, count: number) => `${fractionOf(index, count) * 100}%`;

interface RulerMarksProps {
    ticks: TimelineRulerTick[];
    labelled: number[];
    showMinor: boolean;
}

const RulerMarks = memo(({ ticks, labelled, showMinor }: RulerMarksProps) => {
    const count = ticks.length;
    const labelledSet = new Set(labelled);

    return (
        <>
            {/* One segment per frame, a frame wide: side by side they read as one band with round ends, and each
                fades in as its frame is cached and out when caching ends. */}
            {ticks.map((tick, index) => (
                <span
                    key={`cached-${tick.frame}`}
                    className={cn(
                        'absolute bottom-0 h-0.5 bg-foreground/15 transition-opacity duration-300 ease-out',
                        tick.cached ? 'opacity-100' : 'opacity-0',
                        tick.cached && !ticks[index - 1]?.cached && 'rounded-l-full',
                        tick.cached && !ticks[index + 1]?.cached && 'rounded-r-full'
                    )}
                    style={{
                        left: `${Math.max(0, fractionOf(index - 0.5, count)) * 100}%`,
                        right: `${Math.max(0, 1 - fractionOf(index + 0.5, count)) * 100}%`
                    }}
                    aria-hidden='true'
                />
            ))}
            {ticks.map((tick, index) => {
                const major = labelledSet.has(index);
                // A frame a plugin is queued or running on keeps its mark however dense the ruler, taller and
                // twice as wide, so its colour reads without a label.
                if (!major && !showMinor && !tick.tone) return null;
                return (
                    <span
                        key={tick.frame}
                        className={cn(
                            'timeline-ruler__tick absolute bottom-1 w-px',
                            major ? 'h-2.5 bg-muted' : 'h-1.5 bg-border',
                            tick.tone && cn('-ml-px h-2.5 w-0.5 rounded-full', MARK_TONE_CLASS[tick.tone]),
                            tick.dimmed && 'opacity-35'
                        )}
                        style={{ left: percentOf(index, count), '--tick-at': fractionOf(index, count) } as CSSProperties}
                        aria-hidden='true'
                    />
                );
            })}
            {labelled.map((index) => {
                const tick = ticks[index];
                return (
                    <span
                        key={`label-${tick.frame}`}
                        data-ruler-label=''
                        className={cn(
                            'absolute top-1 -translate-x-1/2 whitespace-nowrap text-2xs leading-none tabular-nums text-muted transition-[opacity,color] duration-[180ms] data-covered:opacity-0',
                            tick.tone && LABEL_TONE_CLASS[tick.tone],
                            tick.dimmed && 'opacity-35'
                        )}
                        style={{ left: percentOf(index, count) }}
                    >
                        {tick.frame}
                    </span>
                );
            })}
        </>
    );
});

RulerMarks.displayName = 'RulerMarks';

interface TimelineRulerProps {
    ticks: TimelineRulerTick[];
    currentFrame: number | undefined;
    isPlaying: boolean;
    frameDelayMs: number;
}

const TimelineRuler = ({ ticks, currentFrame, isPlaying, frameDelayMs }: TimelineRulerProps) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLSpanElement>(null);
    const hoverRef = useRef<HTMLSpanElement>(null);
    const [width, setWidth] = useState(0);
    const [pointerIndex, setPointerIndex] = useState<number | null>(null);

    const timesteps = useMemo(() => ticks.map((tick) => tick.frame), [ticks]);
    const shownTicks = ticks.length > 0 ? ticks : PLACEHOLDER_TICKS;
    const count = shownTicks.length;
    const currentIndex = currentFrame === undefined ? -1 : timesteps.indexOf(currentFrame);
    // A trajectory or range that shrinks under a resting pointer must not leave it past the last frame.
    const hoverIndex = pointerIndex !== null && pointerIndex < timesteps.length ? pointerIndex : null;
    const { isDragging, rulerHandlers } = useTimelineScrubber({ trackRef, rangedTimesteps: timesteps, currentFrame });

    const labelled = useMemo(() => {
        const widest = String(timesteps[timesteps.length - 1] ?? '').length;
        return labelledIndices(timesteps, width, widest * LABEL_DIGIT_WIDTH + LABEL_GAP);
    }, [timesteps, width]);
    const showMinor = count < 2 || width / (count - 1) >= MIN_TICK_SPACING;

    useLayoutEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const measure = () => setWidth(track.clientWidth);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(track);
        return () => observer.disconnect();
    }, []);

    // Playback glides the playhead one frame to the next over the frame's own time; any other move lands at once.
    const previousIndexRef = useRef(currentIndex);
    useLayoutEffect(() => {
        const from = previousIndexRef.current;
        previousIndexRef.current = currentIndex;
        const playhead = playheadRef.current;
        if (!isPlaying || !playhead || currentIndex !== from + 1 || !Number.isFinite(frameDelayMs)) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        playhead.animate(
            [{ left: percentOf(from, count) }, { left: percentOf(currentIndex, count) }],
            { duration: frameDelayMs, easing: 'linear' }
        );
    }, [count, currentIndex, frameDelayMs, isPlaying]);

    // Labels step aside for the thumb and the hover capsule; the capsule steps aside for the thumb.
    useLayoutEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const xOf = (index: number) => fractionOf(index, count) * track.clientWidth;
        const covers: Array<[number, number]> = [];
        const thumb = thumbRef.current;
        const thumbHalf = thumb ? thumb.offsetWidth / 2 : 0;
        if (thumb) covers.push([xOf(currentIndex) - thumbHalf, xOf(currentIndex) + thumbHalf]);

        const hover = hoverRef.current;
        if (hover && hoverIndex !== null) {
            const hoverHalf = hover.offsetWidth / 2;
            const nearThumb = thumb !== null && Math.abs(xOf(hoverIndex) - xOf(currentIndex)) < thumbHalf + hoverHalf + HOVER_THUMB_MARGIN;
            hover.toggleAttribute('data-near', nearThumb);
            if (!nearThumb && !isDragging) covers.push([xOf(hoverIndex) - hoverHalf, xOf(hoverIndex) + hoverHalf]);
        }

        track.querySelectorAll<HTMLElement>('[data-ruler-label]').forEach((label) => {
            const half = label.offsetWidth / 2;
            const covered = covers.some(([start, end]) => label.offsetLeft + half > start - LABEL_CLEARANCE && label.offsetLeft - half < end + LABEL_CLEARANCE);
            label.toggleAttribute('data-covered', covered);
        });
    }, [count, currentIndex, currentFrame, hoverIndex, isDragging, labelled]);

    // Ticks swell around a mouse: the track carries the pointer's share of its width for the CSS.
    const trackHover = (event: PointerEvent<HTMLDivElement>) => {
        const track = trackRef.current;
        if (!track || event.pointerType === 'touch' || timesteps.length === 0) return;
        const box = track.getBoundingClientRect();
        track.style.setProperty('--timeline-ruler-hover', String((event.clientX - box.left) / Math.max(1, box.width)));
        setPointerIndex(indexAtClientX(track, event.clientX, timesteps.length));
    };

    const hasThumb = currentIndex >= 0;
    const currentTone = hasThumb ? ticks[currentIndex]?.tone : undefined;

    return (
        <div
            className='timeline-ruler relative h-10 min-w-0 flex-auto cursor-pointer touch-none select-none rounded-xl outline-none focus-visible:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_15%,transparent)]'
            role='slider'
            tabIndex={0}
            aria-label='Timeline playhead'
            aria-valuemin={timesteps[0]}
            aria-valuemax={timesteps[timesteps.length - 1]}
            aria-valuenow={currentFrame}
            aria-valuetext={currentFrame === undefined ? undefined : `Timestep ${currentFrame}`}
            data-dragging={isDragging || undefined}
            data-hovering={hoverIndex !== null || undefined}
            data-tour-id='canvas-timeline-ruler'
            {...rulerHandlers}
            onPointerMove={(event) => {
                rulerHandlers.onPointerMove(event);
                trackHover(event);
            }}
            onPointerLeave={() => setPointerIndex(null)}
        >
            <div ref={trackRef} className='absolute inset-y-0 inset-x-10 max-md:inset-x-8' style={{ '--timeline-ruler-width': width } as CSSProperties}>
                <RulerMarks ticks={shownTicks} labelled={labelled} showMinor={showMinor} />

                {hoverIndex !== null && (
                    <span
                        ref={hoverRef}
                        className='timeline-ruler__hover pointer-events-none absolute top-0 z-[1] h-5 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground/[0.06] px-2 text-2xs font-medium leading-5 tabular-nums text-muted'
                        style={{ left: percentOf(hoverIndex, count) }}
                        aria-hidden='true'
                    >
                        {timesteps[hoverIndex]}
                    </span>
                )}

                {hasThumb && (
                    <div ref={playheadRef} className='pointer-events-none absolute inset-y-0 z-[2]' style={{ left: percentOf(currentIndex, count) }}>
                        <span
                            ref={thumbRef}
                            className={cn(
                                'timeline-ruler__thumb absolute left-0 top-0 h-5 -translate-x-1/2 whitespace-nowrap rounded-full px-2 text-2xs font-medium leading-5 tabular-nums text-foreground',
                                currentTone && LABEL_TONE_CLASS[currentTone]
                            )}
                        >
                            {currentFrame}
                        </span>
                        <span className='absolute bottom-1 left-0 top-5 -ml-px w-0.5 rounded-full bg-foreground' />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimelineRuler;
