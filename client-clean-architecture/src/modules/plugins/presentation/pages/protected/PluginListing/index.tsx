import { useEffect, useState } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrajectories } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import { useTeamStore } from '@/modules/team/presentation/stores';
import Select from '@/shared/presentation/components/atoms/form/Select';
import PluginExposureTable from '@/modules/plugins/presentation/components/organisms/PluginExposureTable';

const PluginListing = () => {
    usePageTitle('Plugin Listing');
    const { pluginSlug, listingSlug, trajectoryId: paramTrajectoryId } = useParams();
    const navigate = useNavigate();
    const team = useTeamStore((s) => s.selectedTeam);

    const [trajectoryId, setTrajectoryId] = useState<string | undefined>(paramTrajectoryId);
    
    const { trajectories, isLoading } = useTrajectories();

    useEffect(() => {
        setTrajectoryId(paramTrajectoryId);
    }, [paramTrajectoryId]);

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
                    placeholder={isLoading ? 'Loading...' : 'Select Trajectory'}
                    showSelectionIcon={false}
                    disabled={isLoading}
                />
            }
        />
    );
};

export default PluginListing;
