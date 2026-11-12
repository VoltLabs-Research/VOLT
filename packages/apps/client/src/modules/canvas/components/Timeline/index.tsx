import { cn } from '@heroui/react';
import TimelineControls from '../TimelineControls';
import TimelineHeader from '../TimelineHeader';
import TimelineRuler from '../TimelineRuler';
import TimelineTabContent from './TimelineTabContent';
import useFoldingTab, { PANEL_FOLD_MS } from './use-folding-tab';
import useTimelineTabsState, { exposureIdOfTab } from './use-timeline-tabs-state';
import useTimelineJobActivity from './use-timeline-job-activity';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { resolveFrameDelayMs } from '@/modules/canvas/store/editor/playback-slice';
import { resolveRangedTimesteps } from '@/modules/canvas/utils/timeline-range';
import { toAnalysisFrameActivityStatus } from '@/modules/canvas/utils/analysis-status-selectors';

import { memo, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ReactNode } from 'react';
import type { FractalSceneRef } from '@/modules/fractal/contracts/scene-ref';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

const SCENE_ZOOM_SUBSCRIBE_RETRY_MS = 120;
const PANEL_ID = 'canvas-timeline-panel';

interface TimelineProps {
    sceneRef: React.RefObject<FractalSceneRef | null>;
    trajectory: Trajectory | null | undefined;
    trajectoryId?: string;
    currentTimestep: number | undefined;
    availableTimesteps: number[];
    selectedAnalysisTimesteps?: number[];
    analysisId: string | undefined;
    // Shown only while the panel is open: closed, the dock is the tabs, the ruler and the status bar.
    resizeHandle?: ReactNode;
}

const Timeline = ({
    sceneRef,
    trajectory,
    trajectoryId,
    currentTimestep,
    availableTimesteps,
    selectedAnalysisTimesteps,
    analysisId,
    resizeHandle
}: TimelineProps) => {
    const { activeTab, tabs, openTab, pressTab, togglePanel, pluginId, pluginDisplayName } = useTimelineTabsState({
        trajectory,
        analysisId
    });
    const shownTab = useFoldingTab(activeTab);
    const isPanelOpen = activeTab !== null;
    const { getTickTone, getAnalysisFrameStatus, getLiveLogTarget } = useTimelineJobActivity(trajectory?._id, analysisId);

    const {
        playSpeed,
        setPlaySpeed,
        rangeStart,
        rangeEnd,
        setRangeStart,
        setRangeEnd,
        preloadedTimesteps,
        isPlaying,
        targetFps
    } = useEditorStore(useShallow((state) => ({
        playSpeed: state.playSpeed,
        setPlaySpeed: state.setPlaySpeed,
        rangeStart: state.rangeStart,
        rangeEnd: state.rangeEnd,
        setRangeStart: state.setRangeStart,
        setRangeEnd: state.setRangeEnd,
        preloadedTimesteps: state.preloadedTimesteps,
        isPlaying: state.isPlaying,
        targetFps: state.targetFps
    })));

    useEffect(() => {
        if (!availableTimesteps.length) {
            setRangeStart(undefined);
            setRangeEnd(undefined);
            return;
        }
        if (rangeStart === undefined || !availableTimesteps.includes(rangeStart)) {
            setRangeStart(availableTimesteps[0]);
        }
        if (rangeEnd === undefined || !availableTimesteps.includes(rangeEnd)) {
            setRangeEnd(availableTimesteps[availableTimesteps.length - 1]);
        }
    }, [availableTimesteps, rangeStart, rangeEnd, setRangeStart, setRangeEnd]);

    const rangedTimesteps = useMemo(() => {
        return resolveRangedTimesteps(availableTimesteps, rangeStart, rangeEnd);
    }, [availableTimesteps, rangeStart, rangeEnd]);

    const ticks = useMemo(() => {
        const scopedTimesteps = selectedAnalysisTimesteps ? new Set(selectedAnalysisTimesteps) : undefined;
        const cachedTimesteps = new Set(preloadedTimesteps);

        return rangedTimesteps.map((frame) => ({
            frame,
            tone: getTickTone(frame),
            dimmed: scopedTimesteps ? !scopedTimesteps.has(frame) : false,
            cached: cachedTimesteps.has(frame)
        }));
    }, [rangedTimesteps, getTickTone, selectedAnalysisTimesteps, preloadedTimesteps]);

    const startFrame = rangeStart ?? availableTimesteps[0];
    const endFrame = rangeEnd ?? availableTimesteps[availableTimesteps.length - 1];
    const currentFrame = currentTimestep ?? startFrame;
    const liveLogTarget = getLiveLogTarget(analysisId, currentFrame);
    const logAnalysisId = liveLogTarget?.analysisId ?? analysisId;
    const logTimestep = liveLogTarget?.timestep ?? currentFrame;
    const analysisFrameStatus = logAnalysisId
        ? toAnalysisFrameActivityStatus(getAnalysisFrameStatus(logAnalysisId, logTimestep))
        : undefined;

    const [zoomPercent, setZoomPercent] = useState(100);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;
        let retryTimeoutId: number | undefined;

        const trySubscribe = () => {
            if (cancelled) return;
            const scene = sceneRef.current;
            if (scene) {
                unsubscribe = scene.subscribeZoom(setZoomPercent);
                return;
            }
            retryTimeoutId = window.setTimeout(trySubscribe, SCENE_ZOOM_SUBSCRIBE_RETRY_MS);
        };

        trySubscribe();

        return () => {
            cancelled = true;
            if (retryTimeoutId !== undefined) window.clearTimeout(retryTimeoutId);
            unsubscribe?.();
        };
    }, [sceneRef]);

    return (
        <div className='flex min-h-0 flex-col overflow-hidden max-h-[calc(100dvh-2rem)] max-md:gap-2 max-md:items-stretch max-md:overflow-visible max-md:pointer-events-none'>
            {isPanelOpen && resizeHandle}
            <TimelineHeader
                activeTab={activeTab}
                tabs={tabs}
                onTabPress={pressTab}
                onTabSelect={openTab}
                onTogglePanel={togglePanel}
                panelId={PANEL_ID}
                downloadContext={{
                    pluginId,
                    analysisId,
                    trajectoryId: trajectory?._id
                }}
                outputsTitle={pluginDisplayName}
            />

            {/* Unfolds from the tabs instead of popping in; the rows animate from 0fr, so its height can stay the dock's. */}
            <div
                id={PANEL_ID}
                className={cn(
                    'grid min-h-0 transition-[grid-template-rows] ease-[var(--ease-emphasized)] motion-reduce:transition-none max-md:order-2',
                    isPanelOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
                style={{ transitionDuration: `${PANEL_FOLD_MS}ms` }}
                inert={!isPanelOpen}
            >
                <div className='flex min-h-0 flex-col overflow-hidden'>
                    <div className='flex h-[calc(var(--canvas-timeline-size,12rem)-2.25rem)] min-h-0 flex-none flex-col border-y border-foreground/[0.06] max-md:h-auto max-md:border-0'>
                        <TimelineTabContent
                            activeTab={shownTab}
                            activeExposureId={exposureIdOfTab(shownTab)}
                            trajectory={trajectory}
                            analysisId={analysisId}
                            pluginId={pluginId}
                            currentTimestep={currentTimestep}
                            currentFrame={currentFrame}
                            logAnalysisId={logAnalysisId}
                            logTimestep={logTimestep}
                            analysisFrameStatus={analysisFrameStatus}
                        />
                    </div>
                </div>
            </div>

            {/* The ruler is always there, as OVITO's time slider, with the transport beside it. */}
            <div className='flex flex-none flex-row items-center gap-4 pb-1 pl-2 pr-3 pt-1.5 max-md:pointer-events-auto max-md:order-3 max-md:flex-col max-md:items-stretch max-md:gap-1.5 max-md:p-0'>
                <TimelineRuler
                    ticks={ticks}
                    currentFrame={currentFrame}
                    isPlaying={isPlaying}
                    frameDelayMs={resolveFrameDelayMs(playSpeed, targetFps)}
                />
                <TimelineControls
                    trajectoryId={trajectoryId}
                    currentTimestep={currentTimestep}
                    rangedTimesteps={rangedTimesteps}
                    availableTimesteps={availableTimesteps}
                    startFrame={startFrame}
                    endFrame={endFrame}
                    onRangeStartChange={setRangeStart}
                    onRangeEndChange={setRangeEnd}
                    playSpeed={playSpeed}
                    onPlaySpeedChange={setPlaySpeed}
                    zoomPercent={zoomPercent}
                    onZoomPreset={(preset) => sceneRef.current?.zoomTo(preset)}
                />
            </div>
        </div>
    );
};

export default memo(Timeline);
