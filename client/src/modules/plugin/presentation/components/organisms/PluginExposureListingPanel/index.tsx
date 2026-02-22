import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import { usePluginCatalog } from '@/modules/plugin/presentation/hooks';
import PluginExposureTable from '@/modules/plugin/presentation/components/organisms/PluginExposureTable';

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
    const plugin = usePluginStore((state) => state.pluginsById[pluginId]);
    const { ensurePluginById } = usePluginCatalog();

    useEffect(() => {
        if (!pluginId || plugin) return;
        ensurePluginById(pluginId).catch(() => {});
    }, [pluginId, plugin, ensurePluginById]);

    const exposureName = useMemo(() => {
        if (exposureNameParam) return exposureNameParam;
        if (!exposureId || !plugin?.exposures?.length) return undefined;

        const exposure = plugin.exposures.find((item) => item._id === exposureId);
        return exposure?.name;
    }, [exposureNameParam, exposureId, plugin]);

    return (
        <PluginExposureTable
            pluginId={pluginId}
            exposureName={exposureName}
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
