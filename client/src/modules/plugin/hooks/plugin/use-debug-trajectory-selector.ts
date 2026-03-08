import { debugTrajectoriesQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useMemo } from 'react';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';

const useDebugTrajectorySelector = () => {
    const { selectedTrajectoryId, selectedTimestep, setSelectedTrajectory, setSelectedTimestep } = usePluginDebugStore();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();
    const trajectoryQuery = debugTrajectoriesQuery(undefined, {
        meta: { checkRBACError }
    });

    const trajectories = trajectoryQuery.data ?? [];
    const isLoading = trajectoryQuery.isLoading;

    const error = useMemo(() => {
        if (!trajectoryQuery.error) return null;
        return trajectoryQuery.error.message || 'Failed to load trajectories';
    }, [trajectoryQuery.error]);

    const selectedTrajectory = useMemo(() => {
        return trajectories.find((trajectory) => trajectory._id === selectedTrajectoryId) || null;
    }, [trajectories, selectedTrajectoryId]);

    const frames = useMemo(() => {
        return selectedTrajectory?.frames || [];
    }, [selectedTrajectory]);

    return {
        trajectories,
        frames,
        selectedTrajectory,
        selectedTrajectoryId,
        selectedTimestep,
        setSelectedTrajectory,
        setSelectedTimestep,
        isLoading,
        error,
        accessDenied,
        accessDeniedMessage
    };
};

export default useDebugTrajectorySelector;
