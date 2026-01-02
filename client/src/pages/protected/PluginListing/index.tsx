import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import trajectoryApi from '@/services/api/trajectory/trajectory';
import { useTeamStore } from '@/stores/slices/team';
import PluginExposureTable from '@/components/organisms/common/PluginExposureTable';
import PerFrameListingModal from '@/components/organisms/common/PerFrameListingModal';
import Select from '@/components/atoms/form/Select';

const PluginListing = () => {
    const { pluginSlug, listingSlug, trajectoryId: paramTrajectoryId } = useParams();
    const navigate = useNavigate();
    const team = useTeamStore((s) => s.selectedTeam);

    const [trajectoryId, setTrajectoryId] = useState<string | undefined>(paramTrajectoryId);
    const [trajectories, setTrajectories] = useState<any[]>([]);

    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [perFrameConfig, setPerFrameConfig] = useState<any>(null);

    // Track if trajectories have been fetched for this team
    const fetchedForTeamRef = useRef<string | null>(null);

    useEffect(() => {
        setTrajectoryId(paramTrajectoryId);
    }, [paramTrajectoryId]);

    useEffect(() => {
        if (!team?._id) return;
        // Skip if already fetched for this team
        if (fetchedForTeamRef.current === team._id) return;
        fetchedForTeamRef.current = team._id;
        
        trajectoryApi.getAll({ teamId: team._id })
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
        <>
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
            {selectedItem && perFrameConfig && (
                <PerFrameListingModal
                    item={selectedItem}
                    config={perFrameConfig}
                    onClose={() => {
                        setSelectedItem(null);
                        setPerFrameConfig(null);
                    }}
                />
            )}
        </>
    );
};

export default PluginListing;
