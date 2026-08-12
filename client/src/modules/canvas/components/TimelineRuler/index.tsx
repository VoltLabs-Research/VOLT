import { cn } from '@heroui/react';
import { memo } from 'react';
import type { TimelineTickTone } from '@/modules/canvas/utils/analysis-status-selectors';
import type { RefObject } from 'react';

interface TimelineRulerTick {
    frame: number;
    major: boolean;
    tone?: TimelineTickTone;
    dimmed?: boolean;
}

const TimelineRulerTicks = memo(({ ticks }: { ticks: TimelineRulerTick[] }) => {
    const labelToneClass = {
        queued: 'text-warning-soft-foreground',
        running: 'text-info-soft-foreground',
        completed: 'text-success-soft-foreground [text-shadow:0_0_10px_color-mix(in_srgb,var(--success-soft-foreground)_30%,transparent)]'
    } as const;

    const markToneClass = {
        queued: 'bg-warning',
        running: 'bg-accent',
        completed: 'bg-success shadow-[0_0_8px_color-mix(in_srgb,var(--success)_35%,transparent)]'
    } as const;

    return (
        <>
            {ticks.map((tick) => (
                <div key={tick.frame} className={cn('canvas-ruler-tick flex h-full shrink-0 cursor-pointer flex-col items-center px-3 max-md:px-2', tick.dimmed && 'opacity-35 transition-opacity duration-[180ms] ease-out')}>
                    {tick.major && (
                        <span className={cn('whitespace-nowrap text-xs leading-none text-muted transition-[color,text-shadow] duration-[180ms] max-md:text-2xs', tick.tone && labelToneClass[tick.tone])}>
                            {tick.frame}
                        </span>
                    )}
                    <div className={cn(
                        'w-px bg-border transition-[background-color,box-shadow] duration-[180ms]',
                        tick.major ? 'h-2.5 bg-muted max-md:h-[7px]' : 'h-1.5 max-md:h-1',
                        tick.tone && markToneClass[tick.tone]
                    )} />
                </div>
            ))}
        </>
    );
});

TimelineRulerTicks.displayName = 'TimelineRulerTicks';

interface TimelineRulerProps {
    rulerRef: RefObject<HTMLDivElement | null>;
    ticks: TimelineRulerTick[];
    playheadLeft: number;
    startFrame: number;
    endFrame: number;
    currentFrame: number;
    onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
    onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

const TimelineRuler = ({
    rulerRef,
    ticks,
    playheadLeft,
    startFrame,
    endFrame,
    currentFrame,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onKeyDown
}: TimelineRulerProps) => (
    <div className='relative h-full min-h-0 flex-auto'>
        <div className='flex h-full min-h-[22px] touch-pan-y items-end select-none overflow-x-auto overflow-y-hidden border-b border-border outline-none max-md:touch-none' ref={rulerRef} onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel} onKeyDown={onKeyDown} role='slider' tabIndex={0} aria-label='Timeline playhead' aria-valuemin={startFrame} aria-valuemax={endFrame} aria-valuenow={currentFrame} aria-valuetext={`Frame ${currentFrame}`}>
            <TimelineRulerTicks ticks={ticks} />
        </div>

        <div className='pointer-events-none absolute inset-y-0 z-[2] w-0.5 bg-accent' style={{ left: `${playheadLeft}px` }}>
            <div className='absolute -left-1 -top-1 size-2.5 rounded-full bg-accent' />
        </div>
    </div>
);

export default TimelineRuler;
