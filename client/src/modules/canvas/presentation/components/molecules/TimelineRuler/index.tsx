import type { RefObject } from 'react';
import Container from '@/shared/presentation/components/Container';

interface TimelineRulerProps {
    rulerRef: RefObject<HTMLDivElement | null>;
    ticks: { frame: number; major: boolean }[];
    playheadLeft: number;
    currentFrame: number;
    onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
}

const TimelineRuler = ({
    rulerRef,
    ticks,
    playheadLeft,
    currentFrame,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp
}: TimelineRulerProps) => (
    <Container className="canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
        <Container
            className="canvas-timeline-ruler d-flex items-end"
            ref={rulerRef}
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            role="slider"
            aria-valuenow={currentFrame}
        >
            {ticks.map((tick, i) => (
                <Container key={i} className="canvas-ruler-tick d-flex column items-center">
                    {tick.major && (
                        <span className="canvas-ruler-tick-label">{tick.frame}</span>
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
