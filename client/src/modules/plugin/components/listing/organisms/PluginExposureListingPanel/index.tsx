import PluginExposureTable from '@/modules/plugin/components/listing/organisms/PluginExposureTable';
import type { ReactNode } from 'react';

interface PluginExposureListingPanelProps {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId: string;
    compact?: boolean;
    compactStyle?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: ReactNode;
};

const PluginExposureListingPanel = ({
    pluginId,
    exposureName: exposureNameParam,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    compact,
    compactStyle,
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
            compactStyle={compactStyle}
            showTrajectoryColumn={showTrajectoryColumn}
            headerActions={headerActions}
        />
    );
};

export default PluginExposureListingPanel;
