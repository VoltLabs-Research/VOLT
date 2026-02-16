import { useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import { usePluginCatalog } from '@/modules/plugin/presentation/hooks';
import PluginExposureTable from '../../organisms/PluginExposureTable';
import Select from '@/shared/presentation/components/Select';
import useTrajectorySelector from '@/modules/trajectory/presentation/hooks/trajectory/use-trajectory-selector';
import './PluginListingPage.css';

const PluginListingPage = () => {
    const params = useParams();
    const pluginSlug = params.pluginSlug as string;
    const listingSlugParam = params.listingSlug as string | undefined;
    const rawExposureId = params.exposureId as string | undefined;
    const exposureId = rawExposureId && rawExposureId !== 'undefined' && rawExposureId !== 'null'
        ? rawExposureId
        : undefined;
    const trajectoryId = params.trajectoryId as string | null;
    const navigate = useNavigate();
    const team = useTeamStore((s) => s.selectedTeam)!;
    const plugin = usePluginStore((state) => state.pluginsBySlug[pluginSlug]);
    const { ensurePluginBySlug } = usePluginCatalog();
    const { options, isLoading, loadMore } = useTrajectorySelector({
        allowEmpty: true,
        emptyLabel: 'All Trajectories'
    });

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

    const handleTrajectoryChange = useCallback((value: string | null) => {
        if (!exposureId && !listingSlug) {
            return;
        }

        if (value) {
            if (exposureId) {
                navigate(`/dashboard/trajectory/${value}/plugins/${pluginSlug}/exposure/${exposureId}/listing`);
                return;
            }
            navigate(`/dashboard/trajectory/${value}/plugins/${pluginSlug}/listing/${listingSlug}`);
            return;
        }

        if (exposureId) {
            navigate(`/dashboard/plugins/${pluginSlug}/exposure/${exposureId}/listing`);
            return;
        }

        navigate(`/dashboard/plugins/${pluginSlug}/listing/${listingSlug}`);
    }, [navigate, pluginSlug, listingSlug, exposureId]);

    const handleTrajectorySelect = useCallback((value: string) => {
        if (value === '') {
            handleTrajectoryChange(null);
            return;
        }
        handleTrajectoryChange(value);
    }, [handleTrajectoryChange]);

    return (
        <PluginExposureTable
            pluginSlug={pluginSlug}
            listingSlug={listingSlug}
            exposureId={exposureId}
            trajectoryId={trajectoryId ?? undefined}
            teamId={team._id}
            showTrajectoryColumn={!trajectoryId}
            headerActions={
                <Select
                    options={options}
                    value={trajectoryId}
                    onChange={handleTrajectorySelect}
                    placeholder='All Trajectories'
                    isLoading={isLoading}
                    onScrollEnd={loadMore}
                />
            }
        />
    );
};

export default PluginListingPage;
