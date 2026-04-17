import { debugTrajectoriesQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
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
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const trajectoryQuery = debugTrajectoriesQuery(undefined, {
        meta: { checkAccessDeniedError }
    });

    const selectedTrajectoryId = searchParams.get(DEBUG_TRAJECTORY_PARAM) || null;
    const selectedTimestepParam = searchParams.get(DEBUG_TIMESTEP_PARAM);
    const selectedTimestep = useMemo(() => {
        return readSelectedTimestep(selectedTimestepParam);
    }, [selectedTimestepParam]);
    const trajectories = trajectoryQuery.data ?? [];
    const isLoading = trajectoryQuery.isLoading;
    const updateSearchParams = useCallback((updates: Record<string, string | number | boolean | null | undefined>, replace = false) => {
        setSearchParams((prev) => applySearchParamUpdates(prev, updates), { replace });
    }, [setSearchParams]);

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
        isLoading,
        error,
        accessDenied,
        accessDeniedMessage
    };
};

export default useDebugTrajectorySelector;
