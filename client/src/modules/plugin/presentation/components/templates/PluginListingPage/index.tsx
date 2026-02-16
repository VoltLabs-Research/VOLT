import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import PluginExposureListingPanel from '../../organisms/PluginExposureListingPanel';
import Select from '@/shared/presentation/components/Select';
import useTrajectorySelector from '@/modules/trajectory/presentation/hooks/trajectory/use-trajectory-selector';
import './PluginListingPage.css';

const PluginListingPage = () => {
    const params = useParams();
    const pluginSlug = params.pluginSlug as string;
    const rawExposureId = params.exposureId as string | undefined;
    const exposureId = rawExposureId && rawExposureId !== 'undefined' && rawExposureId !== 'null'
        ? rawExposureId
        : undefined;
    const listingSlug = params.listingSlug as string | undefined;
    const trajectoryId = params.trajectoryId as string | null;
    const navigate = useNavigate();
    const team = useTeamStore((s) => s.selectedTeam)!;
    const { options, isLoading, loadMore } = useTrajectorySelector({
        allowEmpty: true,
        emptyLabel: 'All Trajectories'
    });

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
        <PluginExposureListingPanel
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
