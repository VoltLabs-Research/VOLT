import TimelineHeader, { TimelineTab } from '../TimelineHeader';
import TimelineRuler from '../TimelineRuler';
import TimelineTabContent from './TimelineTabContent';
import useTimelineScrubber from './use-timeline-scrubber';
import useTimelineTabsState from './use-timeline-tabs-state';
import useTimelineJobActivity from '../../hooks/use-timeline-job-activity';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { resolveRangedTimesteps } from '@/modules/canvas/utils/timeline-range';
import useTip from '@/shared/tips/use-tip';

import { memo, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Box, Stack } from '@voltstack/bravais';
import type { CanvasExposureDownloadParams } from '../canvas-panel-props';
import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

import './Timeline.css';

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
    onDownloadExposureListing?: (params: CanvasExposureDownloadParams) => void;
}

const Timeline = ({
    sceneRef,
    trajectory,
    trajectoryId,
    currentTimestep,
    availableTimesteps,
    selectedAnalysisTimesteps,
    analysisId,
    disableContextualTips = false,
    onDownloadExposureListing
}: TimelineProps) => {
    useTip('canvas-timeline-scrub', {
        enabled: !disableContextualTips
    });

    const { activeTab, tabs, handleTabChange, activeExposureId, pluginId } = useTimelineTabsState({
        trajectory,
        analysisId
    });
    const { toneByTimestep, getAnalysisFrameStatus } = useTimelineJobActivity(trajectory?._id);

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

    /** Memoised because `TimelineRuler` renders one memoised element per tick. */
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
            tone: toneByTimestep.get(frame),
            dimmed: scopedTimesteps ? !scopedTimesteps.has(frame) : false
        }));
    }, [rangedTimesteps, toneByTimestep, selectedAnalysisTimesteps]);

    const startFrame = rangeStart ?? availableTimesteps[0];
    const endFrame = rangeEnd ?? availableTimesteps[availableTimesteps.length - 1];
    const currentFrame = currentTimestep ?? startFrame;
    const analysisFrameStatus = analysisId
        ? getAnalysisFrameStatus(analysisId, currentFrame)
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

        // The scene mounts independently of the timeline, so poll until its ref is wired.
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
        <Stack
            overflow='hidden'
            minH='0'
            className={activeTab === TimelineTab.Timeline ? 'canvas-timeline canvas-timeline--timeline-active' : 'canvas-timeline'}
        >
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
                onDownloadExposureListing={onDownloadExposureListing}
                downloadContext={{
                    pluginId,
                    analysisId,
                    trajectoryId: trajectory?._id
                }}
            />

            {activeTab === TimelineTab.Timeline && (
                <Box position='relative' className="canvas-timeline-ruler-region" data-tour-id="canvas-timeline-ruler">
                    <TimelineRuler
                        rulerRef={rulerRef}
                        ticks={ticks}
                        playheadLeft={playheadLeft}
                        startFrame={startFrame}
                        endFrame={endFrame}
                        currentFrame={currentFrame}
                        {...rulerHandlers}
                    />
                </Box>
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
        </Stack>
    );
};

export default memo(Timeline);
