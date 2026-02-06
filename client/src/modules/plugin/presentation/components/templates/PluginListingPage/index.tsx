import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import PluginExposureTable from '../../organisms/PluginExposureTable';
import TrajectorySelector from '@/modules/trajectory/presentation/components/molecules/TrajectorySelector';
import './PluginListingPage.css';

const PluginListingPage = () => {
    const { pluginSlug, listingSlug, trajectoryId } = useParams();
    const navigate = useNavigate();
    const team = useTeamStore((s) => s.selectedTeam);

    const handleTrajectoryChange = useCallback((value: string | null) => {
        if (value) {
            navigate(`/dashboard/trajectory/${value}/plugins/${pluginSlug}/listing/${listingSlug}`);
        } else {
            navigate(`/dashboard/plugins/${pluginSlug}/listing/${listingSlug}`);
        }
    }, [navigate, pluginSlug, listingSlug]);

    if (!pluginSlug || !listingSlug) return null;

    return (
        <PluginExposureTable
            pluginSlug={pluginSlug}
            listingSlug={listingSlug}
            trajectoryId={trajectoryId}
            teamId={team?._id}
            showTrajectoryColumn={!trajectoryId}
            headerActions={
                <TrajectorySelector
                    value={trajectoryId || null}
                    onChange={handleTrajectoryChange}
                    placeholder='All Trajectories'
                    allowEmpty
                    emptyLabel='All Trajectories'
                />
            }
        />
    );
};

export default PluginListingPage;
