import { CORE_TABS } from '../../molecules/TimelineHeader';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import SimulationCellView from '../../molecules/SimulationCellView';
import TimelineHeader from '../../molecules/TimelineHeader';
import TimelineRuler from '../../molecules/TimelineRuler';
import useCanvasTimelineTabs from '@/modules/canvas/hooks/use-canvas-timeline-tabs';
import useCanvasUrlState from '@/modules/canvas/hooks/use-canvas-url-state';

import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';

import { useShallow } from 'zustand/react/shallow';
import PluginAtomsTable from '@/modules/plugin/components/listing/organisms/PluginAtomsTable';
import PluginExposureListingPanel from '@/modules/plugin/components/listing/organisms/PluginExposureListingPanel';
import Container from '@/shared/presentation/components/Container';

import type { TimelineTabOption } from '../../molecules/TimelineHeader';
import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

import './Timeline.css';

interface TimelineProps {
    sceneRef: React.RefObject<FractalSceneRef | null>;
    trajectory: Trajectory | null | undefined;
    analysisId: string | undefined;
    onTabChange?: (tab: string) => void;
    onDownloadExposureListing?: (params: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        exposureName?: string;
    }) => void;
};


const Timeline = ({ sceneRef, trajectory, analysisId, onTabChange, onDownloadExposureListing }: TimelineProps) => {
    const [activeTab, setActiveTab] = useState<string>('timeline');
    const { timelineExposureId, setTimelineExposureId } = useCanvasUrlState();
    const selectedTeamId = useSelectedTeamId();
    const { pluginId, isPluginReady, listingExposures } = useCanvasTimelineTabs({ trajectory, analysisId });

    const exposureTabs = useMemo<TimelineTabOption[]>(() => {
        return listingExposures.map((exposure) => ({
            id: `exposure:${exposure.exposureId}`,
            label: exposure.name,
            exposureId: exposure.exposureId
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
        } else if (activeTab.startsWith('sublisting:')) {
            setActiveTab('timeline');
        }
    }, [activeTab, hasExposure, isPluginReady, timelineExposureId, setTimelineExposureId]);

    useEffect(() => {
        if (!analysisId && timelineExposureId) {
            setTimelineExposureId(undefined, { replace: true });
            setActiveTab('timeline');
        }
    }, [analysisId, timelineExposureId, setTimelineExposureId]);

    const activeExposureId = useMemo(() => {
        return activeTab.startsWith('exposure:')
            ? activeTab.replace('exposure:', '')
            : undefined;
    }, [activeTab]);

    const {
        timestepData, currentTimestep, setCurrentTimestep, playSpeed, setPlaySpeed,
        rangeStart, rangeEnd, setRangeStart, setRangeEnd, getRangedTimesteps
    } = useEditorStore(useShallow((state) => ({
        timestepData: state.timestepData,
        currentTimestep: state.currentTimestep,
        setCurrentTimestep: state.setCurrentTimestep,
        playSpeed: state.playSpeed,
        setPlaySpeed: state.setPlaySpeed,
        rangeStart: state.rangeStart,
        rangeEnd: state.rangeEnd,
        setRangeStart: state.setRangeStart,
        setRangeEnd: state.setRangeEnd,
        getRangedTimesteps: state.getRangedTimesteps
    })));

    const availableTimesteps = timestepData.timesteps;

    useEffect(() => {
        if (!availableTimesteps.length) {
            setRangeStart(undefined);
            setRangeEnd(undefined);
            return;
        }
        const first = availableTimesteps[0];
        const last = availableTimesteps[availableTimesteps.length - 1];
        if (rangeStart === undefined || !availableTimesteps.includes(rangeStart)) {
            setRangeStart(first);
        }
        if (rangeEnd === undefined || !availableTimesteps.includes(rangeEnd)) {
            setRangeEnd(last);
        }
    }, [availableTimesteps]);

    const rangedTimesteps = getRangedTimesteps();
    const safeCurrentIndex = rangedTimesteps.indexOf(currentTimestep!);

    const ticks = useMemo(() => {
        if (rangedTimesteps.length === 0) {
            const tickCount = 50;
            return Array.from({ length: tickCount }, (_, i) => ({ frame: i, major: i % 10 === 0 }));
        }
        return rangedTimesteps.map((frame) => ({ frame, major: true }));
    }, [rangedTimesteps]);

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
        if (!ruler || rangedTimesteps.length === 0) return;
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
    }, [safeCurrentIndex, rangedTimesteps.length, scrollToTick]);

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
        if (!ruler || rangedTimesteps.length === 0) return;
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

        if (nearestIndex < rangedTimesteps.length) {
            setCurrentTimestep(rangedTimesteps[nearestIndex]);
        }
    }, [rangedTimesteps, setCurrentTimestep]);

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

    const handleRulerKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!rangedTimesteps.length) {
            return;
        }

        const currentIndex = Math.max(0, rangedTimesteps.indexOf(currentFrame));
        let nextIndex = currentIndex;

        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            nextIndex = Math.max(0, currentIndex - 1);
        }

        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            nextIndex = Math.min(rangedTimesteps.length - 1, currentIndex + 1);
        }

        if (event.key === 'Home') {
            nextIndex = 0;
        }

        if (event.key === 'End') {
            nextIndex = rangedTimesteps.length - 1;
        }

        if (nextIndex === currentIndex) {
            return;
        }

        event.preventDefault();
        setCurrentTimestep(rangedTimesteps[nextIndex]);
    }, [currentFrame, rangedTimesteps, setCurrentTimestep]);

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
                onDownloadExposureListing={onDownloadExposureListing}
                downloadContext={{
                    pluginId,
                    analysisId,
                    trajectoryId: trajectory?._id
                }}
            />

            {activeTab === 'timeline' && (
                <TimelineRuler
                    rulerRef={rulerRef}
                    ticks={ticks}
                    playheadLeft={playheadLeft}
                    startFrame={startFrame}
                    endFrame={endFrame}
                    currentFrame={currentFrame}
                    onClick={handleRulerClick}
                    onPointerDown={handleRulerPointerDown}
                    onPointerMove={handleRulerPointerMove}
                    onPointerUp={handleRulerPointerUp}
                    onWheel={handleRulerWheel}
                    onKeyDown={handleRulerKeyDown}
                />
            )}

            {activeTab === 'particles' && trajectory?._id && (
                <Container className="canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
                    <PluginAtomsTable
                        trajectoryId={trajectory._id}
                        analysisId={analysisId}
                        timestep={currentTimestep}
                    />
                </Container>
            )}

            {activeTab === 'simulation-cell' && (
                <Container className="canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
                    <SimulationCellView trajectory={trajectory} currentTimestep={currentTimestep} />
                </Container>
            )}

            {activeExposureId && trajectory?._id && pluginId && selectedTeamId && (
                <Container className="canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
                    {/* Reuse the dashboard listing flow so row actions keep the exact analysis/exposure/timestep context. */}
                    <PluginExposureListingPanel
                        key={`${pluginId}:${analysisId ?? 'default'}:${trajectory._id}:${activeExposureId}`}
                        pluginId={pluginId}
                        exposureId={activeExposureId}
                        trajectoryId={trajectory._id}
                        analysisId={analysisId}
                        teamId={selectedTeamId}
                        showTrajectoryColumn={false}
                        compact
                    />
                </Container>
            )}
        </Container>
    );
};

export default memo(Timeline);
