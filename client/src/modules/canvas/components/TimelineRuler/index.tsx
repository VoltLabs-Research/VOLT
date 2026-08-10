import { memo } from 'react';
import type { TimelineTickTone } from '@/modules/canvas/utils/analysis-status-selectors';
import type { RefObject } from 'react';

interface TimelineRulerTick {
    frame: number;
    major: boolean;
    tone?: TimelineTickTone;
    dimmed?: boolean;
}

const TimelineRulerTicks = memo(({ ticks }: { ticks: TimelineRulerTick[] }) => (
    <>
        {ticks.map((tick) => (
            <div key={tick.frame} className={`canvas-ruler-tick flex flex-col items-center${tick.tone ? ` is-${tick.tone}` : ''}${tick.dimmed ? ' canvas-ruler-tick--dimmed' : ''}`}>
                {tick.major && (
                    <span className={`canvas-ruler-tick-label text-xs${tick.tone ? ` canvas-ruler-tick-label--${tick.tone}` : ''}`}>
                        {tick.frame}
                    </span>
                )}
                <div className={`canvas-ruler-tick-mark ${tick.major ? 'major' : 'minor'}${tick.tone ? ` canvas-ruler-tick-mark--${tick.tone}` : ''}`} />
            </div>
        ))}
    </>
));

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
    <div className='relative flex-1 min-h-0 canvas-timeline-body'>
        <div className='flex items-end canvas-timeline-ruler scrollbar-none' ref={rulerRef} onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel} onKeyDown={onKeyDown} role="slider" tabIndex={0} aria-label="Timeline playhead" aria-valuemin={startFrame} aria-valuemax={endFrame} aria-valuenow={currentFrame} aria-valuetext={`Frame ${currentFrame}`}>
            <TimelineRulerTicks ticks={ticks} />
        </div>

        <div className='absolute top-0 bottom-0 canvas-playhead' style={{ left: `${playheadLeft}px` }}>
            <div className='absolute canvas-playhead-head' />
        </div>
    </div>
);

export default TimelineRuler;
