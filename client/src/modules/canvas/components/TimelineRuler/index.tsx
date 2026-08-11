import { cn } from '@heroui/react';
import { memo } from 'react';
import {
    PLAYHEAD_CLASS,
    PLAYHEAD_HEAD_CLASS,
    RULER_BODY_CLASS,
    RULER_CLASS,
    TICK_CLASS,
    TICK_DIMMED_CLASS,
    TICK_LABEL_CLASS,
    TICK_LABEL_TONE_CLASS,
    TICK_MARK_CLASS,
    TICK_MARK_MAJOR_CLASS,
    TICK_MARK_MINOR_CLASS,
    TICK_MARK_TONE_CLASS
} from '../Timeline/timeline-classes';
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
            <div key={tick.frame} className={cn(TICK_CLASS, tick.dimmed && TICK_DIMMED_CLASS)}>
                {tick.major && (
                    <span className={cn(TICK_LABEL_CLASS, tick.tone && TICK_LABEL_TONE_CLASS[tick.tone])}>
                        {tick.frame}
                    </span>
                )}
                <div className={cn(
                    TICK_MARK_CLASS,
                    tick.major ? TICK_MARK_MAJOR_CLASS : TICK_MARK_MINOR_CLASS,
                    tick.tone && TICK_MARK_TONE_CLASS[tick.tone]
                )} />
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
    <div className={RULER_BODY_CLASS}>
        <div className={RULER_CLASS} ref={rulerRef} onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel} onKeyDown={onKeyDown} role='slider' tabIndex={0} aria-label='Timeline playhead' aria-valuemin={startFrame} aria-valuemax={endFrame} aria-valuenow={currentFrame} aria-valuetext={`Frame ${currentFrame}`}>
            <TimelineRulerTicks ticks={ticks} />
        </div>

        <div className={PLAYHEAD_CLASS} style={{ left: `${playheadLeft}px` }}>
            <div className={PLAYHEAD_HEAD_CLASS} />
        </div>
    </div>
);

export default TimelineRuler;
