import { CORE_TABS, TimelineTab } from '../TimelineHeader';
import useCanvasTimelineTabs from './use-canvas-timeline-tabs';
import useCanvasUrlState from '@/modules/canvas/hooks/use-canvas-url-state';
import { useTimelineTabRequestStore } from '@/modules/canvas/store/use-timeline-tab-request-store';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TimelineTabOption } from '../TimelineHeader';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

const EXPOSURE_TAB_PREFIX = 'exposure:';

export const exposureIdOfTab = (tabId: string | null): string | undefined => {
    return tabId?.startsWith(EXPOSURE_TAB_PREFIX) ? tabId.slice(EXPOSURE_TAB_PREFIX.length) : undefined;
};

interface UseTimelineTabsStateParams {
    trajectory: Trajectory | null | undefined;
    analysisId: string | undefined;
}

const useTimelineTabsState = ({ trajectory, analysisId }: UseTimelineTabsStateParams) => {
    // null while the panel is closed; the chevron reopens the tab that was open last.
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [lastTab, setLastTab] = useState<string>(TimelineTab.Particles);
    const { timelineExposureId, setTimelineExposureId } = useCanvasUrlState();
    const { pluginId, pluginDisplayName, isPluginReady, listingExposures } = useCanvasTimelineTabs({
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

    const openTab = useCallback((tab: string) => {
        setActiveTab(tab);
        setLastTab(tab);

        const exposureId = exposureIdOfTab(tab);
        if (exposureId !== undefined) {
            setTimelineExposureId(exposureId, { replace: true });
        } else if (timelineExposureId) {
            setTimelineExposureId(undefined, { replace: true });
        }
    }, [setTimelineExposureId, timelineExposureId]);

    const closePanel = useCallback(() => {
        setActiveTab(null);
        if (timelineExposureId) {
            setTimelineExposureId(undefined, { replace: true });
        }
    }, [setTimelineExposureId, timelineExposureId]);

    const pressTab = useCallback((tab: string) => {
        if (tab === activeTab) closePanel();
        else openTab(tab);
    }, [activeTab, closePanel, openTab]);

    const reopenableTab = tabs.some((tab) => tab.id === lastTab) ? lastTab : TimelineTab.Particles;
    const togglePanel = useCallback(() => {
        if (activeTab === null) openTab(reopenableTab);
        else closePanel();
    }, [activeTab, closePanel, openTab, reopenableTab]);

    const requestedTab = useTimelineTabRequestStore((state) => state.requestedTab);
    const clearTabRequest = useTimelineTabRequestStore((state) => state.clearRequest);
    const canOpenRequestedTab = requestedTab !== null && tabs.some((tab) => tab.id === requestedTab);

    useEffect(() => {
        if (!requestedTab || !canOpenRequestedTab) return;
        openTab(requestedTab);
        clearTabRequest();
    }, [canOpenRequestedTab, clearTabRequest, openTab, requestedTab]);

    useEffect(() => {
        if (timelineExposureId && exposureIds.has(timelineExposureId)) {
            const exposureTab = `${EXPOSURE_TAB_PREFIX}${timelineExposureId}`;
            setActiveTab(exposureTab);
            setLastTab(exposureTab);
            return;
        }

        const activeExposureId = exposureIdOfTab(activeTab);

        if (timelineExposureId && isPluginReady) {
            setTimelineExposureId(undefined, { replace: true });
            if (activeExposureId !== undefined) {
                setActiveTab(null);
            }
            return;
        }

        if (activeExposureId !== undefined && !exposureIds.has(activeExposureId)) {
            setActiveTab(null);
            if (timelineExposureId) {
                setTimelineExposureId(undefined, { replace: true });
            }
        }
    }, [activeTab, exposureIds, isPluginReady, timelineExposureId, setTimelineExposureId]);

    useEffect(() => {
        if (analysisId) return;

        if (timelineExposureId) {
            setTimelineExposureId(undefined, { replace: true });
            setActiveTab(null);
        }

        if (activeTab === TimelineTab.Log) {
            setActiveTab(null);
        }
    }, [activeTab, analysisId, timelineExposureId, setTimelineExposureId]);

    return {
        activeTab,
        tabs,
        openTab,
        pressTab,
        togglePanel,
        pluginId,
        pluginDisplayName
    };
};

export default useTimelineTabsState;
