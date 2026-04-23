import PluginExposureListingPanel from '@/modules/plugin/components/listing/PluginExposureListingPanel';
import { LISTING_QUERY_KEYS } from '@/modules/plugin/hooks/listing/queries';
import { Select } from '@/shared/presentation/primitives';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTrajectorySelector from '@/modules/trajectory/hooks/trajectory/use-trajectory-selector';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './PluginListingPage.css';

const PluginListingPage = () => {
    const params = useParams();
    const pluginId = params.pluginId ?? '';
    const rawExposureId = params.exposureId;
    let exposureId: string | undefined;
    if (rawExposureId && rawExposureId !== 'undefined' && rawExposureId !== 'null') {
        exposureId = rawExposureId;
    }
    const exposureName = params.exposureName;
    const trajectoryId = params.trajectoryId ?? null;
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
