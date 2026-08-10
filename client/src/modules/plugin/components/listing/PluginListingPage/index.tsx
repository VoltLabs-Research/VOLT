import PluginExposureTable from '@/modules/plugin/components/listing/PluginExposureTable';
import { LISTING_QUERY_KEYS } from '@/modules/plugin/hooks/listing/queries';
import { PluginSelect } from '@/modules/plugin/components/plugin/PluginSelect';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTrajectorySelector from '@/modules/trajectory/hooks/trajectory/use-trajectory-selector';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const PluginListingPage = () => {
    const params = useParams();
    const pluginId = params.pluginId ?? '';
    const exposureName = params.exposureName;
    const trajectoryId = params.trajectoryId;
    // Stale links can carry the literal strings `undefined` / `null` in the path.
    const rawExposureId = params.exposureId;
    const exposureId = rawExposureId && rawExposureId !== 'undefined' && rawExposureId !== 'null'
        ? rawExposureId
        : undefined;

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

    const handleTrajectorySelect = useCallback((value: string) => {
        if(!exposureId && !exposureName){
            return;
        }

        const pluginPath = value
            ? `/dashboard/trajectory/${value}/plugins/${pluginId}`
            : `/dashboard/plugins/${pluginId}`;

        navigate(exposureId
            ? `${pluginPath}/exposure/${exposureId}/listing`
            : `${pluginPath}/listing/${exposureName}`);
    }, [navigate, pluginId, exposureName, exposureId]);

    return (
        <PluginExposureTable
            pluginId={pluginId}
            exposureName={exposureName}
            exposureId={exposureId}
            trajectoryId={trajectoryId}
            teamId={team._id}
            showTrajectoryColumn={!trajectoryId}
            headerActions={
                <PluginSelect
                    options={options}
                    value={trajectoryId ?? null}
                    onChange={handleTrajectorySelect}
                    placeholder='All Trajectories'
                    ariaLabel='Trajectory'
                    isPending={isLoading}
                    onScrollEnd={loadMore}
                />
            }
        />
    );
};

export default PluginListingPage;
