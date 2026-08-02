import { CORE_TABS, TimelineTab } from '../TimelineHeader';
import useCanvasTimelineTabs from '@/modules/canvas/hooks/use-canvas-timeline-tabs';
import useCanvasUrlState from '@/modules/canvas/hooks/use-canvas-url-state';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TimelineTabOption } from '../TimelineHeader';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

const TOUR_SELECT_TIMELINE_TAB_EVENT = 'canvas-analysis-tour:select-timeline-tab';
const EXPOSURE_TAB_PREFIX = 'exposure:';

const exposureIdOfTab = (tabId: string): string | undefined => {
    return tabId.startsWith(EXPOSURE_TAB_PREFIX) ? tabId.slice(EXPOSURE_TAB_PREFIX.length) : undefined;
};

interface UseTimelineTabsStateParams {
    trajectory: Trajectory | null | undefined;
    analysisId: string | undefined;
}

/**
 * Keeps the active timeline tab, the tab list and the `timelineExposureId` URL parameter
 * in sync. Exposure tabs come and go with the selected analysis, so a tab that is no
 * longer backed by an exposure falls back to the ruler.
 */
const useTimelineTabsState = ({ trajectory, analysisId }: UseTimelineTabsStateParams) => {
    const [activeTab, setActiveTab] = useState<string>(TimelineTab.Timeline);
    const { timelineExposureId, setTimelineExposureId } = useCanvasUrlState();
    const { pluginId, isPluginReady, listingExposures } = useCanvasTimelineTabs({
        trajectory,
        analysisId
    });

    const exposureIds = useMemo(() => {
        return new Set(listingExposures.map((exposure) => exposure.exposureId));
    }, [listingExposures]);

    const tabs: TimelineTabOption[] = [
        ...CORE_TABS,
        ...(analysisId ? [{
            id: TimelineTab.Log,
            label: 'Log'
        }] : []),
        ...listingExposures.map((exposure) => ({
            id: `${EXPOSURE_TAB_PREFIX}${exposure.exposureId}`,
            label: exposure.name,
            exposureId: exposure.exposureId
        }))
    ];

    const handleTabChange = useCallback((tab: string) => {
        setActiveTab(tab);

        const exposureId = exposureIdOfTab(tab);
        if (exposureId !== undefined) {
            setTimelineExposureId(exposureId, { replace: true });
        } else if (timelineExposureId) {
            setTimelineExposureId(undefined, { replace: true });
        }
    }, [setTimelineExposureId, timelineExposureId]);

    useEffect(() => {
        const selectTimelineTab = () => handleTabChange(TimelineTab.Timeline);

        window.addEventListener(TOUR_SELECT_TIMELINE_TAB_EVENT, selectTimelineTab);
        return () => {
            window.removeEventListener(TOUR_SELECT_TIMELINE_TAB_EVENT, selectTimelineTab);
        };
    }, [handleTabChange]);

    useEffect(() => {
        if (timelineExposureId && exposureIds.has(timelineExposureId)) {
            setActiveTab(`${EXPOSURE_TAB_PREFIX}${timelineExposureId}`);
            return;
        }

        const activeExposureId = exposureIdOfTab(activeTab);

        if (timelineExposureId && isPluginReady) {
            setTimelineExposureId(undefined, { replace: true });
            if (activeExposureId !== undefined) {
                setActiveTab(TimelineTab.Timeline);
            }
            return;
        }

        if (activeExposureId !== undefined && !exposureIds.has(activeExposureId)) {
            setActiveTab(TimelineTab.Timeline);
            if (timelineExposureId) {
                setTimelineExposureId(undefined, { replace: true });
            }
        }
    }, [activeTab, exposureIds, isPluginReady, timelineExposureId, setTimelineExposureId]);

    useEffect(() => {
        if (analysisId) return;

        if (timelineExposureId) {
            setTimelineExposureId(undefined, { replace: true });
            setActiveTab(TimelineTab.Timeline);
        }

        if (activeTab === TimelineTab.Log) {
            setActiveTab(TimelineTab.Timeline);
        }
    }, [activeTab, analysisId, timelineExposureId, setTimelineExposureId]);

    return {
        activeTab,
        tabs,
        handleTabChange,
        activeExposureId: exposureIdOfTab(activeTab),
        pluginId
    };
};

export default useTimelineTabsState;
