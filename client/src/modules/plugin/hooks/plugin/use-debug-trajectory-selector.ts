import { debugTrajectoriesQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { applySearchParamUpdates } from '@/shared/ui/hooks/use-search-params';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const DEBUG_TRAJECTORY_PARAM = 'debugTrajectory';
const DEBUG_TIMESTEP_PARAM = 'debugTimestep';

const readSelectedTimestep = (value: string | null): number | null => {
    if (!value) {
        return null;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
};

const useDebugTrajectorySelector = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const trajectoryQuery = debugTrajectoriesQuery(undefined);

    const selectedTrajectoryId = searchParams.get(DEBUG_TRAJECTORY_PARAM) || null;
    const selectedTimestepParam = searchParams.get(DEBUG_TIMESTEP_PARAM);
    const selectedTimestep = readSelectedTimestep(selectedTimestepParam);
    const trajectoriesData = trajectoryQuery.data;
    const trajectories = useMemo(() => trajectoriesData ?? [], [trajectoriesData]);

    const updateSearchParams = useCallback((updates: Record<string, string | number | boolean | null | undefined>, replace = false) => {
        setSearchParams((prev) => applySearchParamUpdates(prev, updates), { replace });
    }, [setSearchParams]);

    const selectedTrajectory = useMemo(() => {
        return trajectories.find((trajectory) => trajectory._id === selectedTrajectoryId) || null;
    }, [trajectories, selectedTrajectoryId]);

    const frames = useMemo(() => {
        return selectedTrajectory?.frames || [];
    }, [selectedTrajectory]);

    const setSelectedTrajectory = useCallback((trajectoryId: string | null) => {
        updateSearchParams({
            [DEBUG_TRAJECTORY_PARAM]: trajectoryId,
            [DEBUG_TIMESTEP_PARAM]: null
        });
    }, [updateSearchParams]);

    const setSelectedTimestep = useCallback((timestep: number | null) => {
        updateSearchParams({
            [DEBUG_TIMESTEP_PARAM]: timestep
        });
    }, [updateSearchParams]);

    useEffect(() => {
        if (!selectedTrajectoryId) {
            return;
        }

        if (!selectedTrajectory) {
            updateSearchParams({
                [DEBUG_TRAJECTORY_PARAM]: null,
                [DEBUG_TIMESTEP_PARAM]: null
            }, true);
        }
    }, [selectedTrajectory, selectedTrajectoryId, updateSearchParams]);

    useEffect(() => {
        if (!selectedTimestepParam) {
            return;
        }

        if (selectedTimestep === null) {
            updateSearchParams({ [DEBUG_TIMESTEP_PARAM]: null }, true);
            return;
        }

        const hasSelectedFrame = frames.some((frame) => frame.timestep === selectedTimestep);
        if (!hasSelectedFrame) {
            updateSearchParams({ [DEBUG_TIMESTEP_PARAM]: null }, true);
        }
    }, [frames, selectedTimestep, selectedTimestepParam, updateSearchParams]);

    return {
        trajectories,
        frames,
        selectedTrajectory,
        selectedTrajectoryId,
        selectedTimestep,
        setSelectedTrajectory,
        setSelectedTimestep,
        isLoading: trajectoryQuery.isLoading
    };
};

export default useDebugTrajectorySelector;
