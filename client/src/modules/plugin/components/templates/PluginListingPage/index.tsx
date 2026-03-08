import { useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import PluginExposureListingPanel from '@/modules/plugin/components/organisms/PluginExposureListingPanel';
import { LISTING_QUERY_KEYS } from '@/modules/plugin/hooks/listing/queries';
import Select from '@/shared/presentation/components/Select';
import useTrajectorySelector from '@/modules/trajectory/hooks/use-trajectory-selector';
import './PluginListingPage.css';

const PluginListingPage = () => {
    const params = useParams();
    const pluginId = params.pluginId as string;
    const rawExposureId = params.exposureId as string | undefined;
    const exposureId = rawExposureId && rawExposureId !== 'undefined' && rawExposureId !== 'null'
        ? rawExposureId
        : undefined;
    const exposureName = params.exposureName as string | undefined;
    const trajectoryId = params.trajectoryId as string | null;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const team = useSelectedTeam()!;
    const { options, isLoading, loadMore } = useTrajectorySelector({
        allowEmpty: true,
        emptyLabel: 'All Trajectories'
    });

    useEffect(() => {
        return () => {
            queryClient.removeQueries({ queryKey: LISTING_QUERY_KEYS.listing() });
            queryClient.removeQueries({ queryKey: LISTING_QUERY_KEYS.listingInfinite() });
            queryClient.removeQueries({ queryKey: LISTING_QUERY_KEYS.subListing() });
            queryClient.removeQueries({ queryKey: LISTING_QUERY_KEYS.subListingInfinite() });
        };
    }, [queryClient]);

    const handleTrajectoryChange = useCallback((value: string | null) => {
        if (!exposureId && !exposureName) {
            return;
        }

        if (value) {
            if (exposureId) {
                navigate(`/dashboard/trajectory/${value}/plugins/${pluginId}/exposure/${exposureId}/listing`);
                return;
            }
            navigate(`/dashboard/trajectory/${value}/plugins/${pluginId}/listing/${exposureName}`);
            return;
        }

        if (exposureId) {
            navigate(`/dashboard/plugins/${pluginId}/exposure/${exposureId}/listing`);
            return;
        }

        navigate(`/dashboard/plugins/${pluginId}/listing/${exposureName}`);
    }, [navigate, pluginId, exposureName, exposureId]);

    const handleTrajectorySelect = useCallback((value: string) => {
        if (value === '') {
            handleTrajectoryChange(null);
            return;
        }
        handleTrajectoryChange(value);
    }, [handleTrajectoryChange]);

    return (
        <PluginExposureListingPanel
            pluginId={pluginId}
            exposureName={exposureName}
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
