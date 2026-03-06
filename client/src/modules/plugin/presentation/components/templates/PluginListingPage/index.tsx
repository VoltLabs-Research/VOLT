import { useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import PluginExposureListingPanel from '../../organisms/PluginExposureListingPanel';
import usePluginStore from '../../../stores/use-plugin-store';
import Select from '@/shared/presentation/components/Select';
import useTrajectorySelector from '@/modules/trajectory/presentation/hooks/trajectory/use-trajectory-selector';
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
    const team = useTeamStore((s) => s.selectedTeam)!;
    const resetPlugins = usePluginStore((state) => state.resetPlugins);
    const { options, isLoading, loadMore } = useTrajectorySelector({
        allowEmpty: true,
        emptyLabel: 'All Trajectories'
    });

    useEffect(() => {
        return () => {
            resetPlugins();
        };
    }, [resetPlugins]);

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
