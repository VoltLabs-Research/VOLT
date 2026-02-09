import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import PluginExposureTable from '../../organisms/PluginExposureTable';
import Select from '@/shared/presentation/components/Select';
import useTrajectorySelector from '@/modules/trajectory/presentation/hooks/trajectory/use-trajectory-selector';
import './PluginListingPage.css';

const PluginListingPage = () => {
    const params = useParams();
    const pluginSlug = params.pluginSlug as string;
    const listingSlug = params.listingSlug as string;
    const trajectoryId = params.trajectoryId as string | null;
    const navigate = useNavigate();
    const team = useTeamStore((s) => s.selectedTeam)!;
    const { options, isLoading, loadMore } = useTrajectorySelector({
        allowEmpty: true,
        emptyLabel: 'All Trajectories'
    });

    const handleTrajectoryChange = useCallback((value: string | null) => {
        if (value) {
            navigate(`/dashboard/trajectory/${value}/plugins/${pluginSlug}/listing/${listingSlug}`);
            return;
        }
        navigate(`/dashboard/plugins/${pluginSlug}/listing/${listingSlug}`);
    }, [navigate, pluginSlug, listingSlug]);

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
            trajectoryId={trajectoryId}
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
