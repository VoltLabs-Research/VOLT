import { CORE_TABS, TimelineTab } from '../TimelineHeader';
import AnalysisLogPanel from '../AnalysisLogPanel';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import SimulationCellView from '../SimulationCellView';
import TimelineHeader from '../TimelineHeader';
import TimelineRuler from '../TimelineRuler';
import useTimelineJobActivity from '../../hooks/use-timeline-job-activity';
import useCanvasTimelineTabs from '@/modules/canvas/hooks/use-canvas-timeline-tabs';
import useCanvasUrlState from '@/modules/canvas/hooks/use-canvas-url-state';
import { resolveRangedTimesteps } from '@/modules/canvas/utilities/timeline-range';
import useTip from '@/shared/tips/use-tip';

import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';

import { useShallow } from 'zustand/react/shallow';
import PluginAtomsTable from '@/modules/plugin/components/listing/PluginAtomsTable';
import PluginExposureListingPanel from '@/modules/plugin/components/listing/PluginExposureListingPanel';
import type { TimelineTabOption } from '../TimelineHeader';
import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

import './Timeline.css';

interface TimelineProps {
    sceneRef: React.RefObject<FractalSceneRef | null>;
    trajectory: Trajectory | null | undefined;
    trajectoryId?: string;
    currentTimestep: number | undefined;
    availableTimesteps: number[];
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


const Timeline = ({
    sceneRef,
    trajectory,
    trajectoryId,
    currentTimestep,
    availableTimesteps,
    analysisId,
    onTabChange,
    onDownloadExposureListing
}: TimelineProps) => {
    useTip('canvas-timeline-scrub');

    const [activeTab, setActiveTab] = useState<string>('timeline');
    const { timelineExposureId, setTimelineExposureId } = useCanvasUrlState();
    const selectedTeamId = useSelectedTeamId();
    const { pluginId, isPluginReady, listingExposures } = useCanvasTimelineTabs({ trajectory, analysisId });
    const { toneByTimestep, getAnalysisFrameStatus } = useTimelineJobActivity(trajectory?._id);

    const exposureTabs = useMemo<TimelineTabOption[]>(() => {
        return listingExposures.map((exposure) => ({
            id: `exposure:${exposure.exposureId}`,
            label: exposure.name,
            exposureId: exposure.exposureId
        }));
    }, [listingExposures]);

    const tabs = useMemo<TimelineTabOption[]>(() => {
        const nextTabs = [...CORE_TABS];

        if (analysisId) {
            nextTabs.push({
                id: TimelineTab.Log,
                label: 'Log'
            });
        }

        return [...nextTabs, ...exposureTabs];
    }, [analysisId, exposureTabs]);

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

        if (!analysisId && activeTab === TimelineTab.Log) {
            setActiveTab(TimelineTab.Timeline);
        }
    }, [activeTab, analysisId, timelineExposureId, setTimelineExposureId]);

    const activeExposureId = useMemo(() => {
        return activeTab.startsWith('exposure:')
            ? activeTab.replace('exposure:', '')
            : undefined;
    }, [activeTab]);

    const {
        setCurrentTimestep,
        playSpeed,
        setPlaySpeed,
        rangeStart,
        rangeEnd,
        setRangeStart,
        setRangeEnd
    } = useEditorStore(useShallow((state) => ({
        setCurrentTimestep: state.setCurrentTimestep,
        playSpeed: state.playSpeed,
        setPlaySpeed: state.setPlaySpeed,
        rangeStart: state.rangeStart,
        rangeEnd: state.rangeEnd,
        setRangeStart: state.setRangeStart,
        setRangeEnd: state.setRangeEnd
    })));

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
    }, [availableTimesteps, rangeStart, rangeEnd, setRangeStart, setRangeEnd]);

    const rangedTimesteps = useMemo(() => {
        return resolveRangedTimesteps(availableTimesteps, rangeStart, rangeEnd);
    }, [availableTimesteps, rangeStart, rangeEnd]);
    const safeCurrentIndex = rangedTimesteps.indexOf(currentTimestep!);

    const ticks = useMemo(() => {
        if (rangedTimesteps.length === 0) {
            const tickCount = 50;
            return Array.from({ length: tickCount }, (_, i) => ({ frame: i, major: i % 10 === 0 }));
        }
        return rangedTimesteps.map((frame) => ({
            frame,
            major: true,
            tone: toneByTimestep.get(frame)
        }));
    }, [rangedTimesteps, toneByTimestep]);

    const startFrame = rangeStart ?? availableTimesteps[0];
    const endFrame = rangeEnd ?? availableTimesteps[availableTimesteps.length - 1];
    const currentFrame = currentTimestep ?? startFrame;
    const analysisFrameStatus = analysisId && typeof currentFrame === 'number'
        ? getAnalysisFrameStatus(analysisId, currentFrame)
        : undefined;
    const isLiveLogFrame = analysisFrameStatus === 'running';

    const rulerRef = useRef<HTMLDivElement>(null);
    const tickElementsRef = useRef<HTMLDivElement[]>([]);
    const tickCentersRef = useRef<number[]>([]);
    const [playheadLeft, setPlayheadLeft] = useState<number>(0);
    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const pendingScrubRafRef = useRef<number | null>(null);
    const pendingScrubClientXRef = useRef<number | null>(null);

    const [zoomPercent, setZoomPercent] = useState(100);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;
        let retryTimeoutId: number | undefined;

        const trySubscribe = () => {
            if (cancelled) return;
            const scene = sceneRef.current;
            if (scene?.subscribeZoom) {
                unsubscribe = scene.subscribeZoom((nextZoom) => setZoomPercent(nextZoom));
                return;
            }
            retryTimeoutId = window.setTimeout(trySubscribe, 120);
        };

        trySubscribe();

        return () => {
            cancelled = true;
            if (retryTimeoutId !== undefined) window.clearTimeout(retryTimeoutId);
            unsubscribe?.();
        };
    }, [sceneRef]);

    const handleZoomPreset = useCallback((preset: number) => {
        sceneRef.current?.zoomTo?.(preset);
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

    const collectTickElements = useCallback((): HTMLDivElement[] => {
        const ruler = rulerRef.current;
        if (!ruler) {
            tickElementsRef.current = [];
            tickCentersRef.current = [];
            return [];
        }

        const tickElements = Array.from(ruler.querySelectorAll<HTMLDivElement>('.canvas-ruler-tick'));
        tickElementsRef.current = tickElements;
        tickCentersRef.current = tickElements.map((el) => el.offsetLeft + el.offsetWidth / 2);
        return tickElements;
    }, []);

    useEffect(() => {
        collectTickElements();
    }, [collectTickElements, ticks]);

    useEffect(() => {
        const ruler = rulerRef.current;
        if (!ruler) return;
        const resizeObserver = new ResizeObserver(() => collectTickElements());
        resizeObserver.observe(ruler);
        return () => resizeObserver.disconnect();
    }, [collectTickElements]);

    const updatePlayheadPosition = useCallback(() => {
        const ruler = rulerRef.current;
        if (!ruler || rangedTimesteps.length === 0) return;
        if (tickElementsRef.current.length === 0) {
            collectTickElements();
        }
        const tickEl = tickElementsRef.current[safeCurrentIndex];
        if (!tickEl) return;
        const tickCenter = tickCentersRef.current[safeCurrentIndex] ?? (tickEl.offsetLeft + tickEl.offsetWidth / 2);
        const scrollOffset = ruler.scrollLeft;
        setPlayheadLeft(tickCenter - scrollOffset);

        const rulerWidth = ruler.clientWidth;
        const visibleLeft = scrollOffset;
        const visibleRight = scrollOffset + rulerWidth;
        const margin = 40;
        if (tickCenter < visibleLeft + margin || tickCenter > visibleRight - margin) {
            scrollToTick(tickEl, !isDraggingRef.current);
        }
    }, [collectTickElements, safeCurrentIndex, rangedTimesteps.length, scrollToTick]);

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

    const applyScrubAtClientX = useCallback((clientX: number) => {
        const ruler = rulerRef.current;
        if (!ruler || rangedTimesteps.length === 0) return;
        if (tickCentersRef.current.length === 0) {
            collectTickElements();
        }
        const centers = tickCentersRef.current;
        if (centers.length === 0) return;

        const rulerRect = ruler.getBoundingClientRect();
        const localX = clientX - rulerRect.left + ruler.scrollLeft;

        let lo = 0;
        let hi = centers.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (centers[mid] < localX) lo = mid + 1;
            else hi = mid;
        }

        let nearestIndex = lo;
        if (nearestIndex > 0 && Math.abs(centers[nearestIndex - 1] - localX) <= Math.abs(centers[nearestIndex] - localX)) {
            nearestIndex -= 1;
        }

        if (nearestIndex < rangedTimesteps.length) {
            setCurrentTimestep(rangedTimesteps[nearestIndex]);
        }
    }, [collectTickElements, rangedTimesteps, setCurrentTimestep]);

    const scheduleScrub = useCallback((clientX: number) => {
        pendingScrubClientXRef.current = clientX;
        if (pendingScrubRafRef.current !== null) return;
        pendingScrubRafRef.current = window.requestAnimationFrame(() => {
            pendingScrubRafRef.current = null;
            const pending = pendingScrubClientXRef.current;
            pendingScrubClientXRef.current = null;
            if (pending !== null) applyScrubAtClientX(pending);
        });
    }, [applyScrubAtClientX]);

    useEffect(() => {
        return () => {
            if (pendingScrubRafRef.current !== null) {
                window.cancelAnimationFrame(pendingScrubRafRef.current);
                pendingScrubRafRef.current = null;
            }
        };
    }, []);

    const handleRulerClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        applyScrubAtClientX(event.clientX);
    }, [applyScrubAtClientX]);

    const handleRulerPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        setIsDragging(true);
        isDraggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        applyScrubAtClientX(event.clientX);
    }, [applyScrubAtClientX]);

    const handleRulerPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        scheduleScrub(event.clientX);
    }, [isDragging, scheduleScrub]);

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
        <div className="volt-container canvas-timeline d-flex column overflow-hidden min-h-0">
            <TimelineHeader
                activeTab={activeTab}
                onTabChange={handleTabChange}
                tabs={tabs}
                trajectoryId={trajectoryId}
                currentTimestep={currentTimestep}
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
                <div className='volt-container p-relative'>
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
                </div>
            )}

            {activeTab === 'particles' && trajectory?._id && (
                <div className="volt-container canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
                    <PluginAtomsTable
                        trajectoryId={trajectory._id}
                        analysisId={analysisId}
                    />
                </div>
            )}

            {activeTab === 'simulation-cell' && (
                <div className="volt-container canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
                    <SimulationCellView trajectory={trajectory} currentTimestep={currentTimestep} />
                </div>
            )}

            {activeTab === TimelineTab.Log && analysisId && (
                <div className="volt-container canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
                    <AnalysisLogPanel
                        analysisId={analysisId}
                        timestep={currentFrame}
                        active={activeTab === TimelineTab.Log}
                        live={isLiveLogFrame}
                        activityStatus={analysisFrameStatus}
                    />
                </div>
            )}

            {activeExposureId && trajectory?._id && pluginId && selectedTeamId && (
                <div className="volt-container canvas-timeline-body flex-1 p-relative overflow-hidden min-h-0">
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
                </div>
            )}
        </div>
    );
};

export default memo(Timeline);
