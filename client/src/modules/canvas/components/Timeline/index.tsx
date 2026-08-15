import { cn } from '@heroui/react';
import TimelineHeader, { TimelineTab } from '../TimelineHeader';
import TimelineRuler from '../TimelineRuler';
import TimelineTabContent from './TimelineTabContent';
import useTimelineScrubber from './use-timeline-scrubber';
import useTimelineTabsState from './use-timeline-tabs-state';
import useTimelineJobActivity from './use-timeline-job-activity';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { resolveRangedTimesteps } from '@/modules/canvas/utils/timeline-range';
import { toAnalysisFrameActivityStatus } from '@/modules/canvas/utils/analysis-status-selectors';
import useTip from '@/shared/tips/use-tip';

import { memo, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { FractalSceneRef } from '@/modules/fractal/contracts/scene-ref';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

const SCENE_ZOOM_SUBSCRIBE_RETRY_MS = 120;
const PLACEHOLDER_TICK_COUNT = 50;

interface TimelineProps {
    sceneRef: React.RefObject<FractalSceneRef | null>;
    trajectory: Trajectory | null | undefined;
    trajectoryId?: string;
    currentTimestep: number | undefined;
    availableTimesteps: number[];
    selectedAnalysisTimesteps?: number[];
    analysisId: string | undefined;
    disableContextualTips?: boolean;
}

const Timeline = ({
    sceneRef,
    trajectory,
    trajectoryId,
    currentTimestep,
    availableTimesteps,
    selectedAnalysisTimesteps,
    analysisId,
    disableContextualTips = false
}: TimelineProps) => {
    useTip('canvas-timeline-scrub', {
        enabled: !disableContextualTips
    });

    const { activeTab, tabs, handleTabChange, activeExposureId, pluginId } = useTimelineTabsState({
        trajectory,
        analysisId
    });
    const { getTickTone, getAnalysisFrameStatus } = useTimelineJobActivity(trajectory?._id, analysisId);

    const {
        playSpeed,
        setPlaySpeed,
        rangeStart,
        rangeEnd,
        setRangeStart,
        setRangeEnd
    } = useEditorStore(useShallow((state) => ({
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
        if (rangedTimesteps.length === 0) {
            return Array.from({ length: PLACEHOLDER_TICK_COUNT }, (_, index) => ({
                frame: index,
                major: index % 10 === 0
            }));
        }

        const scopedTimesteps = selectedAnalysisTimesteps ? new Set(selectedAnalysisTimesteps) : undefined;

        return rangedTimesteps.map((frame) => ({
            frame,
            major: true,
            tone: getTickTone(frame),
            dimmed: scopedTimesteps ? !scopedTimesteps.has(frame) : false
        }));
    }, [rangedTimesteps, getTickTone, selectedAnalysisTimesteps]);

    const startFrame = rangeStart ?? availableTimesteps[0];
    const endFrame = rangeEnd ?? availableTimesteps[availableTimesteps.length - 1];
    const currentFrame = currentTimestep ?? startFrame;
    const analysisFrameStatus = analysisId
        ? toAnalysisFrameActivityStatus(getAnalysisFrameStatus(analysisId, currentFrame))
        : undefined;

    const { rulerRef, playheadLeft, rulerHandlers } = useTimelineScrubber({
        rangedTimesteps,
        currentTimestep,
        currentFrame
    });

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
        <div className={cn(
            'flex min-h-0 flex-col overflow-hidden max-h-[calc(100dvh-2rem)] max-md:gap-2 max-md:items-stretch max-md:overflow-visible max-md:pointer-events-none',
            activeTab === TimelineTab.Timeline ? 'h-auto' : 'h-[var(--canvas-timeline-size,12rem)]'
        )}>
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
                onZoomPreset={(preset) => sceneRef.current?.zoomTo(preset)}
                onRangeStartChange={setRangeStart}
                onRangeEndChange={setRangeEnd}
                playSpeed={playSpeed}
                onPlaySpeedChange={setPlaySpeed}
                downloadContext={{
                    pluginId,
                    analysisId,
                    trajectoryId: trajectory?._id
                }}
            />

            {activeTab === TimelineTab.Timeline && (
                <div className='relative h-[25px] min-h-[25px] flex-none max-md:pointer-events-auto max-md:order-2 max-md:h-8 max-md:min-h-8 max-md:min-w-0 max-md:self-stretch max-md:overflow-auto' data-tour-id='canvas-timeline-ruler'>
                    <TimelineRuler
                        rulerRef={rulerRef}
                        ticks={ticks}
                        playheadLeft={playheadLeft}
                        startFrame={startFrame}
                        endFrame={endFrame}
                        currentFrame={currentFrame}
                        {...rulerHandlers}
                    />
                </div>
            )}

            <TimelineTabContent
                activeTab={activeTab}
                activeExposureId={activeExposureId}
                trajectory={trajectory}
                analysisId={analysisId}
                pluginId={pluginId}
                currentTimestep={currentTimestep}
                currentFrame={currentFrame}
                analysisFrameStatus={analysisFrameStatus}
            />
        </div>
    );
};

export default memo(Timeline);
