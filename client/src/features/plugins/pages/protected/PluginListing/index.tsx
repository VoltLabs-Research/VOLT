import { useEffect, useState, useRef } from 'react';
import { usePageTitle } from '@/hooks/core/use-page-title';
import { useParams, useNavigate } from 'react-router-dom';
import trajectoryApi from '@/features/trajectory/api/trajectory';
import { useTeamStore } from '@/features/team/stores';
import Select from '@/components/atoms/form/Select';
import PluginExposureTable from '@/features/plugins/components/organisms/PluginExposureTable';

const PluginListing = () => {
    usePageTitle('Plugin Listing');
    const { pluginSlug, listingSlug, trajectoryId: paramTrajectoryId } = useParams();
    const navigate = useNavigate();
    const team = useTeamStore((s) => s.selectedTeam);

    const [trajectoryId, setTrajectoryId] = useState<string | undefined>(paramTrajectoryId);
    const [trajectories, setTrajectories] = useState<any[]>([]);

    useEffect(() => {
        setTrajectoryId(paramTrajectoryId);
    }, [paramTrajectoryId]);

    useEffect(() => {
        if (!team?._id) return;

        trajectoryApi.getAll({})
            .then(data => setTrajectories(data))
            .catch(err => console.error('Failed to load trajectories', err));
    }, [team?._id]);

    const handleTrajectoryChange = (newTrajId: string) => {
        if (newTrajId) {
            navigate(`/dashboard/trajectory/${newTrajId}/plugins/${pluginSlug}/listing/${listingSlug}`);
        } else {
            navigate(`/dashboard/plugins/${pluginSlug}/listing/${listingSlug}`);
        }
    };

    if (!pluginSlug || !listingSlug) {
        return null;
    }

    return (
        <PluginExposureTable
            pluginSlug={pluginSlug}
            listingSlug={listingSlug}
            trajectoryId={trajectoryId}
            teamId={team?._id}
            showTrajectoryColumn={!trajectoryId}
            headerActions={
                <Select
                    options={[
                        { value: '', title: 'All Trajectories' },
                        ...trajectories.map(t => ({ value: t._id, title: t.name }))
                    ]}
                    value={trajectoryId || ''}
                    onChange={handleTrajectoryChange}
                    placeholder='Select Trajectory'
                    showSelectionIcon={false}
                />
            }
        />
    );
};

export default PluginListing;
