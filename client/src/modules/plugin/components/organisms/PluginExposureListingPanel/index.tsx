import type { ReactNode } from 'react';
import PluginExposureTable from '@/modules/plugin/components/organisms/PluginExposureTable';

interface PluginExposureListingPanelProps {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId: string;
    compact?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: ReactNode;
}

const PluginExposureListingPanel = ({
    pluginId,
    exposureName: exposureNameParam,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    compact,
    showTrajectoryColumn,
    headerActions
}: PluginExposureListingPanelProps) => {
    return (
        <PluginExposureTable
            pluginId={pluginId}
            exposureName={exposureNameParam}
            exposureId={exposureId}
            trajectoryId={trajectoryId}
            analysisId={analysisId}
            teamId={teamId}
            compact={compact}
            showTrajectoryColumn={showTrajectoryColumn}
            headerActions={headerActions}
        />
    );
};

export default PluginExposureListingPanel;
