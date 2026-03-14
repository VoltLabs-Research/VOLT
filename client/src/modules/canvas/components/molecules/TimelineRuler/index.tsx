import Container from '@/shared/presentation/components/Container';

import type { RefObject } from 'react';

interface TimelineRulerProps {
    rulerRef: RefObject<HTMLDivElement | null>;
    ticks: { frame: number; major: boolean }[];
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
};

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
    <Container className="canvas-timeline-body flex-1 p-relative min-h-0">
        <Container
            className="canvas-timeline-ruler scrollbar-none d-flex items-end"
            ref={rulerRef}
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
            role="slider"
            tabIndex={0}
            aria-label="Timeline playhead"
            aria-valuemin={startFrame}
            aria-valuemax={endFrame}
            aria-valuenow={currentFrame}
            aria-valuetext={`Frame ${currentFrame}`}
        >
            {ticks.map((tick, i) => (
                <Container key={i} className="canvas-ruler-tick d-flex column items-center">
                    {tick.major && (
                        <span className="canvas-ruler-tick-label font-size-1">{tick.frame}</span>
                    )}
                    <Container className={`canvas-ruler-tick-mark ${tick.major ? 'major' : 'minor'}`} />
                </Container>
            ))}
        </Container>

        <Container className="canvas-playhead p-absolute top-0 bottom-0" style={{ left: `${playheadLeft}px` }}>
            <Container className="canvas-playhead-head p-absolute" />
        </Container>
    </Container>
);

export default TimelineRuler;
