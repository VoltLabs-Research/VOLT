import AnalysisLogPanel from '../AnalysisLogPanel';
import SimulationCellView from '../SimulationCellView';
import { TimelineTab } from '../TimelineHeader';
import PluginAtomsTable from '@/modules/plugin/components/listing/PluginAtomsTable';
import PluginExposureTable from '@/modules/plugin/components/listing/PluginExposureTable';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

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
    <div className='relative h-full min-h-0 flex-auto overflow-hidden max-md:pointer-events-auto max-md:order-2 max-md:h-auto max-md:min-h-0 max-md:min-w-0 max-md:flex-1 max-md:self-stretch max-md:overflow-auto max-md:rounded-xl max-md:border-0 max-md:bg-surface-secondary'>
        {children}
    </div>
);

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
