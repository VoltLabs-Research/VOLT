import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import { usePluginCatalog } from '@/modules/plugin/presentation/hooks';
import PluginExposureTable from '@/modules/plugin/presentation/components/organisms/PluginExposureTable';

interface PluginExposureListingPanelProps {
    pluginSlug: string;
    listingSlug?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId: string;
    compact?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: ReactNode;
}

const PluginExposureListingPanel = ({
    pluginSlug,
    listingSlug: listingSlugParam,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    compact,
    showTrajectoryColumn,
    headerActions
}: PluginExposureListingPanelProps) => {
    const plugin = usePluginStore((state) => state.pluginsBySlug[pluginSlug]);
    const { ensurePluginBySlug } = usePluginCatalog();

    useEffect(() => {
        if (!pluginSlug || plugin) return;
        ensurePluginBySlug(pluginSlug).catch(() => {});
    }, [pluginSlug, plugin, ensurePluginBySlug]);

    const listingSlug = useMemo(() => {
        if (listingSlugParam) return listingSlugParam;
        if (!exposureId || !plugin?.exposures?.length) return undefined;

        const exposure = plugin.exposures.find((item) => item._id === exposureId);
        return exposure?.name;
    }, [listingSlugParam, exposureId, plugin]);

    return (
        <PluginExposureTable
            pluginSlug={pluginSlug}
            listingSlug={listingSlug}
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
