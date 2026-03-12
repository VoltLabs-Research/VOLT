import { debugTrajectoriesQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useMemo } from 'react';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';

const useDebugTrajectorySelector = () => {
    const selectedTrajectoryId = usePluginDebugStore((state) => state.selectedTrajectoryId);
    const selectedTimestep = usePluginDebugStore((state) => state.selectedTimestep);
    const setSelectedTrajectory = usePluginDebugStore((state) => state.setSelectedTrajectory);
    const setSelectedTimestep = usePluginDebugStore((state) => state.setSelectedTimestep);
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const trajectoryQuery = debugTrajectoriesQuery(undefined, {
        meta: { checkAccessDeniedError }
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
