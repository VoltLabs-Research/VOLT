import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import Container from '@/shared/presentation/components/Container';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { useShallow } from 'zustand/react/shallow';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import type { FractalSceneRef } from '@/modules/fractal/presentation/components/organisms/FractalScene';
import TimelineHeader, { type TimelineTab } from '../../molecules/TimelineHeader';
import TimelineRuler from '../../molecules/TimelineRuler';
import PluginAtomsTable from '@/modules/plugin/presentation/components/organisms/PluginAtomsTable';
import SimulationCellView from '../../molecules/SimulationCellView';
import './Timeline.css';

interface TimelineProps {
    sceneRef: React.RefObject<FractalSceneRef | null>;
    trajectory: Trajectory | null | undefined;
    analysisId: string | undefined;
}


const Timeline = ({ sceneRef, trajectory, analysisId }: TimelineProps) => {
    const [activeTab, setActiveTab] = useState<TimelineTab>('timeline');

    const resolvedExposureId = useMemo(() => {
        if (!trajectory?.analysis?.length) return undefined;
        for (const analysis of trajectory.analysis) {
            if ((analysis as any).exposures?.length) {
                const exposure = (analysis as any).exposures.find(
                    (e: any) => e.perAtomProperties?.length > 0
                );
                if (exposure) return exposure._id;
            }
        }
        return undefined;
    }, [trajectory?.analysis]);

    const {
        timestepData, currentTimestep, setCurrentTimestep
    } = useEditorStore(useShallow((state) => ({
        timestepData: state.timestepData,
        currentTimestep: state.currentTimestep,
        setCurrentTimestep: state.setCurrentTimestep
    })));

    const availableTimesteps = timestepData.timesteps;
    const safeCurrentIndex = availableTimesteps.indexOf(currentTimestep!);

    const ticks = useMemo(() => {
        if (availableTimesteps.length === 0) {
            const tickCount = 50;
            return Array.from({ length: tickCount }, (_, i) => ({ frame: i, major: i % 10 === 0 }));
        }
        return availableTimesteps.map((frame) => ({ frame, major: true }));
    }, [availableTimesteps]);

    const [rangeStart, setRangeStart] = useState<number | undefined>(undefined);
    const [rangeEnd, setRangeEnd] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (!availableTimesteps.length) return;
        setRangeStart((prev) => prev ?? availableTimesteps[0]);
        setRangeEnd((prev) => prev ?? availableTimesteps[availableTimesteps.length - 1]);
    }, [availableTimesteps]);

    const startFrame = rangeStart ?? availableTimesteps[0];
    const endFrame = rangeEnd ?? availableTimesteps[availableTimesteps.length - 1];
    const currentFrame = currentTimestep ?? startFrame;

    const rulerRef = useRef<HTMLDivElement>(null);
    const [playheadLeft, setPlayheadLeft] = useState<number>(0);
    const [isDragging, setIsDragging] = useState(false);

    const [zoomPercent, setZoomPercent] = useState(100);
    const lastZoomRef = useRef(100);

    useEffect(() => {
        let rafId: number | null = null;
        const updateZoom = () => {
            if (sceneRef.current?.getCurrentZoom) {
                const newZoom = sceneRef.current.getCurrentZoom();
                if (Math.abs(newZoom - lastZoomRef.current) > 1) {
                    lastZoomRef.current = newZoom;
                    setZoomPercent(newZoom);
                }
            }
            rafId = requestAnimationFrame(updateZoom);
        };
        rafId = requestAnimationFrame(updateZoom);
        return () => { if (rafId !== null) cancelAnimationFrame(rafId); };
    }, [sceneRef]);

    const handleZoomPreset = useCallback((preset: number) => {
        if (sceneRef.current?.zoomTo) {
            sceneRef.current.zoomTo(preset);
            lastZoomRef.current = preset;
            setZoomPercent(preset);
        }
    }, [sceneRef]);

    const updatePlayheadPosition = useCallback(() => {
        const ruler = rulerRef.current;
        if (!ruler || availableTimesteps.length === 0) return;
        const tickElements = ruler.querySelectorAll<HTMLDivElement>('.canvas-ruler-tick');
        const tickEl = tickElements[safeCurrentIndex];
        if (!tickEl) return;
        const tickCenter = tickEl.offsetLeft + tickEl.offsetWidth / 2;
        const scrollOffset = ruler.scrollLeft;
        setPlayheadLeft(tickCenter - scrollOffset);
    }, [safeCurrentIndex, availableTimesteps.length]);

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

    const pickNearestTimestep = useCallback((clientX: number) => {
        const ruler = rulerRef.current;
        if (!ruler || availableTimesteps.length === 0) return;
        const tickElements = ruler.querySelectorAll<HTMLDivElement>('.canvas-ruler-tick');
        if (tickElements.length === 0) return;

        let nearestIndex = 0;
        let minDist = Infinity;

        for (let i = 0; i < tickElements.length; i++) {
            const rect = tickElements[i].getBoundingClientRect();
            const tickCenterX = rect.left + rect.width / 2;
            const dist = Math.abs(clientX - tickCenterX);
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = i;
            }
        }

        if (nearestIndex < availableTimesteps.length) {
            setCurrentTimestep(availableTimesteps[nearestIndex]);
        }
    }, [availableTimesteps, setCurrentTimestep]);

    const handleRulerClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        pickNearestTimestep(event.clientX);
    }, [pickNearestTimestep]);

    const handleRulerPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        setIsDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        pickNearestTimestep(event.clientX);
    }, [pickNearestTimestep]);

    const handleRulerPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        pickNearestTimestep(event.clientX);
    }, [isDragging, pickNearestTimestep]);

    const handleRulerPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        setIsDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
    }, [isDragging]);

    return (
        <Container className="canvas-timeline d-flex column overflow-hidden min-h-0">
            <TimelineHeader
                activeTab={activeTab}
                onTabChange={setActiveTab}
                startFrame={startFrame}
                endFrame={endFrame}
                availableTimesteps={availableTimesteps}
                zoomPercent={zoomPercent}
                onZoomPreset={handleZoomPreset}
                onRangeStartChange={setRangeStart}
                onRangeEndChange={setRangeEnd}
            />

            {activeTab === 'timeline' && (
                <TimelineRuler
                    rulerRef={rulerRef}
                    ticks={ticks}
                    playheadLeft={playheadLeft}
                    currentFrame={currentFrame}
                    onClick={handleRulerClick}
                    onPointerDown={handleRulerPointerDown}
                    onPointerMove={handleRulerPointerMove}
                    onPointerUp={handleRulerPointerUp}
                />
            )}

            {activeTab === 'particles' && trajectory?._id && (
                <Container className="canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
                    <PluginAtomsTable
                        trajectoryId={trajectory._id}
                        analysisId={analysisId}
                        exposureId={resolvedExposureId}
                    />
                </Container>
            )}

            {activeTab === 'simulation-cell' && (
                <Container className="canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
                    <SimulationCellView trajectory={trajectory} currentTimestep={currentTimestep} />
                </Container>
            )}
        </Container>
    );
};

export default Timeline;
