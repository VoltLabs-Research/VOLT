import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import Container from '@/shared/presentation/components/Container';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { useShallow } from 'zustand/react/shallow';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import type { FractalSceneRef } from '@/modules/fractal/presentation/components/organisms/FractalScene';
import TimelineHeader, { CORE_TABS, type TimelineTabOption } from '../../molecules/TimelineHeader';
import TimelineRuler from '../../molecules/TimelineRuler';
import PluginAtomsTable from '@/modules/plugin/presentation/components/organisms/PluginAtomsTable';
import PluginExposureListingPanel from '@/modules/plugin/presentation/components/organisms/PluginExposureListingPanel';
import SimulationCellView from '../../molecules/SimulationCellView';
import useCanvasUrlState from '@/modules/canvas/presentation/hooks/use-canvas-url-state';
import useCanvasTimelineTabs from '@/modules/canvas/presentation/hooks/use-canvas-timeline-tabs';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import './Timeline.css';

interface TimelineProps {
    sceneRef: React.RefObject<FractalSceneRef | null>;
    trajectory: Trajectory | null | undefined;
    analysisId: string | undefined;
    onTabChange?: (tab: string) => void;
}


const Timeline = ({ sceneRef, trajectory, analysisId, onTabChange }: TimelineProps) => {
    const [activeTab, setActiveTab] = useState<string>('timeline');
    const { timelineExposureId, setTimelineExposureId } = useCanvasUrlState();
    const selectedTeamId = useTeamStore((state) => state.selectedTeam?._id);
    const { pluginSlug, isPluginReady, listingExposures, atomExposureId } = useCanvasTimelineTabs({ trajectory, analysisId });

    const exposureTabs = useMemo<TimelineTabOption[]>(() => {
        return listingExposures.map((exposure) => ({
            id: `exposure:${exposure.exposureId}`,
            label: exposure.name
        }));
    }, [listingExposures]);

    const tabs = useMemo<TimelineTabOption[]>(() => {
        return [...CORE_TABS, ...exposureTabs];
    }, [exposureTabs]);

    const hasExposure = useCallback((exposureId?: string) => {
        if (!exposureId) return false;
        return listingExposures.some((item) => item.exposureId === exposureId);
    }, [listingExposures]);

    const handleTabChange = useCallback((tab: string) => {
        setActiveTab(tab);
        if (tab.startsWith('exposure:')) {
            setTimelineExposureId(tab.replace('exposure:', ''), { replace: true });
        } else if (timelineExposureId) {
            setTimelineExposureId(undefined, { replace: true });
        }
        onTabChange?.(tab);
    }, [onTabChange, setTimelineExposureId, timelineExposureId]);

    useEffect(() => {
        if (timelineExposureId && hasExposure(timelineExposureId)) {
            setActiveTab(`exposure:${timelineExposureId}`);
            return;
        }

        if (timelineExposureId && isPluginReady && !hasExposure(timelineExposureId)) {
            setTimelineExposureId(undefined, { replace: true });
            if (activeTab.startsWith('exposure:')) {
                setActiveTab('timeline');
            }
            return;
        }

        if (activeTab.startsWith('exposure:')) {
            const exposureId = activeTab.replace('exposure:', '');
            if (!hasExposure(exposureId)) {
                setActiveTab('timeline');
                if (timelineExposureId) {
                    setTimelineExposureId(undefined, { replace: true });
                }
            }
        }
    }, [activeTab, hasExposure, isPluginReady, timelineExposureId, setTimelineExposureId]);

    useEffect(() => {
        if (!analysisId && timelineExposureId) {
            setTimelineExposureId(undefined, { replace: true });
            setActiveTab('timeline');
        }
    }, [analysisId, timelineExposureId, setTimelineExposureId]);

    const resolvedExposureId = useMemo(() => {
        if (atomExposureId) return atomExposureId;
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
    }, [trajectory?.analysis, atomExposureId]);

    const activeExposureId = useMemo(() => {
        return activeTab.startsWith('exposure:')
            ? activeTab.replace('exposure:', '')
            : undefined;
    }, [activeTab]);

    const {
        timestepData, currentTimestep, setCurrentTimestep, playSpeed, setPlaySpeed
    } = useEditorStore(useShallow((state) => ({
        timestepData: state.timestepData,
        currentTimestep: state.currentTimestep,
        setCurrentTimestep: state.setCurrentTimestep,
        playSpeed: state.playSpeed,
        setPlaySpeed: state.setPlaySpeed
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
    const isDraggingRef = useRef(false);

    const [zoomPercent, setZoomPercent] = useState(100);
    const lastZoomRef = useRef(100);

    useEffect(() => {
        const id = setInterval(() => {
            if (sceneRef.current?.getCurrentZoom) {
                const newZoom = sceneRef.current.getCurrentZoom();
                if (Math.abs(newZoom - lastZoomRef.current) > 1) {
                    lastZoomRef.current = newZoom;
                    setZoomPercent(newZoom);
                }
            }
        }, 500);
        return () => clearInterval(id);
    }, [sceneRef]);

    const handleZoomPreset = useCallback((preset: number) => {
        if (sceneRef.current?.zoomTo) {
            sceneRef.current.zoomTo(preset);
            lastZoomRef.current = preset;
            setZoomPercent(preset);
        }
    }, [sceneRef]);

    const scrollToTick = useCallback((tickEl: HTMLDivElement, smooth: boolean) => {
        const ruler = rulerRef.current;
        if (!ruler) return;
        const tickCenter = tickEl.offsetLeft + tickEl.offsetWidth / 2;
        const rulerWidth = ruler.clientWidth;
        const targetScroll = tickCenter - rulerWidth / 2;
        ruler.scrollTo({
            left: targetScroll,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }, []);

    const updatePlayheadPosition = useCallback(() => {
        const ruler = rulerRef.current;
        if (!ruler || availableTimesteps.length === 0) return;
        const tickElements = ruler.querySelectorAll<HTMLDivElement>('.canvas-ruler-tick');
        const tickEl = tickElements[safeCurrentIndex];
        if (!tickEl) return;
        const tickCenter = tickEl.offsetLeft + tickEl.offsetWidth / 2;
        const scrollOffset = ruler.scrollLeft;
        setPlayheadLeft(tickCenter - scrollOffset);

        // Auto-scroll: if the active tick is outside the visible region, scroll to it
        const rulerWidth = ruler.clientWidth;
        const visibleLeft = scrollOffset;
        const visibleRight = scrollOffset + rulerWidth;
        const margin = 40;
        if (tickCenter < visibleLeft + margin || tickCenter > visibleRight - margin) {
            scrollToTick(tickEl, !isDraggingRef.current);
        }
    }, [safeCurrentIndex, availableTimesteps.length, scrollToTick]);

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
        isDraggingRef.current = true;
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
        isDraggingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
    }, [isDragging]);

    const handleRulerWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        const ruler = rulerRef.current;
        if (!ruler) return;
        // Translate vertical wheel into horizontal scroll
        const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
        ruler.scrollLeft += delta;
    }, []);

    return (
        <Container className="canvas-timeline d-flex column overflow-hidden min-h-0">
            <TimelineHeader
                activeTab={activeTab}
                onTabChange={handleTabChange}
                tabs={tabs}
                startFrame={startFrame}
                endFrame={endFrame}
                availableTimesteps={availableTimesteps}
                zoomPercent={zoomPercent}
                onZoomPreset={handleZoomPreset}
                onRangeStartChange={setRangeStart}
                onRangeEndChange={setRangeEnd}
                playSpeed={playSpeed}
                onPlaySpeedChange={setPlaySpeed}
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
                    onWheel={handleRulerWheel}
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

            {activeExposureId && trajectory?._id && pluginSlug && selectedTeamId && (
                <Container className="canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
                    <PluginExposureListingPanel
                        pluginSlug={pluginSlug}
                        exposureId={activeExposureId}
                        trajectoryId={trajectory._id}
                        analysisId={analysisId}
                        teamId={selectedTeamId}
                        compact
                        showTrajectoryColumn={false}
                    />
                </Container>
            )}
        </Container>
    );
};

export default memo(Timeline);
