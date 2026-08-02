import AnalysisLogPanel from '../AnalysisLogPanel';
import SimulationCellView from '../SimulationCellView';
import { TimelineTab } from '../TimelineHeader';
import PluginAtomsTable from '@/modules/plugin/components/listing/PluginAtomsTable';
import PluginExposureTable from '@/modules/plugin/components/listing/PluginExposureTable';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

import { Box } from '@voltstack/bravais';
import type { ComponentProps, ReactNode } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface TimelineTabContentProps {
    activeTab: string;
    activeExposureId?: string;
    trajectory: Trajectory | null | undefined;
    analysisId: string | undefined;
    pluginId?: string;
    currentTimestep: number | undefined;
    currentFrame: number;
    analysisFrameStatus?: ComponentProps<typeof AnalysisLogPanel>['activityStatus'];
}

const TabBody = ({ children }: { children: ReactNode }) => (
    <Box flex='1' position='relative' overflow='hidden' minH='0' className="canvas-timeline-body">
        {children}
    </Box>
);

/** Body of the timeline for every tab except the ruler, which owns its own region. */
const TimelineTabContent = ({
    activeTab,
    activeExposureId,
    trajectory,
    analysisId,
    pluginId,
    currentTimestep,
    currentFrame,
    analysisFrameStatus
}: TimelineTabContentProps) => {
    const selectedTeamId = useSelectedTeamId();
    const trajectoryId = trajectory?._id;

    if (activeTab === TimelineTab.Particles && trajectoryId) {
        return (
            <TabBody>
                <PluginAtomsTable trajectoryId={trajectoryId} analysisId={analysisId} />
            </TabBody>
        );
    }

    if (activeTab === TimelineTab.SimulationCell) {
        return (
            <TabBody>
                <SimulationCellView trajectory={trajectory} currentTimestep={currentTimestep} />
            </TabBody>
        );
    }

    if (activeTab === TimelineTab.Log && analysisId) {
        return (
            <TabBody>
                <AnalysisLogPanel
                    analysisId={analysisId}
                    timestep={currentFrame}
                    active
                    live={analysisFrameStatus === 'running'}
                    activityStatus={analysisFrameStatus}
                />
            </TabBody>
        );
    }

    if (activeExposureId && trajectoryId && pluginId) {
        return (
            <TabBody>
                {/* Reuse the dashboard listing flow so row actions keep the exact analysis/exposure/timestep context. */}
                <PluginExposureTable
                    key={`${pluginId}:${analysisId ?? 'default'}:${trajectoryId}:${activeExposureId}`}
                    pluginId={pluginId}
                    exposureId={activeExposureId}
                    trajectoryId={trajectoryId}
                    analysisId={analysisId}
                    teamId={selectedTeamId ?? undefined}
                    showTrajectoryColumn={false}
                    compact
                    inlineSubListings
                />
            </TabBody>
        );
    }

    return null;
};

export default TimelineTabContent;
