import type { TimelineTickTone } from '@/modules/canvas/hooks/use-timeline-job-activity';
import type { RefObject } from 'react';

interface TimelineRulerTick {
    frame: number;
    major: boolean;
    tone?: TimelineTickTone;
}

interface TimelineRulerProps {
    rulerRef: RefObject<HTMLDivElement | null>;
    ticks: TimelineRulerTick[];
    playheadLeft: number;
    startFrame: number;
    endFrame: number;
    currentFrame: number;
    helperTextId?: string;
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
    helperTextId,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onKeyDown
}: TimelineRulerProps) => (
    <div className="canvas-timeline-body flex-1 p-relative min-h-0">
        <div className="canvas-timeline-ruler scrollbar-none d-flex items-end" ref={rulerRef} onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel} onKeyDown={onKeyDown} role="slider" tabIndex={0} aria-label="Timeline playhead" aria-describedby={helperTextId} aria-valuemin={startFrame} aria-valuemax={endFrame} aria-valuenow={currentFrame} aria-valuetext={`Frame ${currentFrame}`}>
            {ticks.map((tick) => (
                <div key={tick.frame} className={`canvas-ruler-tick d-flex column items-center${tick.tone ? ` is-${tick.tone}` : ''}`}>
                    {tick.major && (
                        <span className={`canvas-ruler-tick-label font-size-1${tick.tone ? ` canvas-ruler-tick-label--${tick.tone}` : ''}`}>
                            {tick.frame}
                        </span>
                    )}
                    <div className={`canvas-ruler-tick-mark ${tick.major ? 'major' : 'minor'}${tick.tone ? ` canvas-ruler-tick-mark--${tick.tone}` : ''}`} />
                </div>
            ))}
        </div>

        <div className="canvas-playhead p-absolute top-0 bottom-0" style={{ left: `${playheadLeft}px` }}>
            <div className="canvas-playhead-head p-absolute" />
        </div>
    </div>
);

export default TimelineRuler;
