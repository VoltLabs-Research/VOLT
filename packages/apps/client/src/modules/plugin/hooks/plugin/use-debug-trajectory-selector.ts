import { debugTrajectoriesQuery, useTrajectoryByIdQuery } from '@/modules/trajectory/hooks/trajectory/queries';
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

    // The listing has no frames, so the selected trajectory's frames come from its detail.
    const trajectoryDetailQuery = useTrajectoryByIdQuery(selectedTrajectoryId ?? '', {
        enabled: Boolean(selectedTrajectoryId)
    });

    const updateSearchParams = useCallback((updates: Record<string, string | number | boolean | null | undefined>, replace = false) => {
        setSearchParams((prev) => applySearchParamUpdates(prev, updates), { replace });
    }, [setSearchParams]);

    const selectedTrajectory = useMemo(() => {
        return trajectories.find((trajectory) => trajectory._id === selectedTrajectoryId) || null;
    }, [trajectories, selectedTrajectoryId]);

    const trajectoryDetail = trajectoryDetailQuery.data;
    const frames = useMemo(() => {
        if (!selectedTrajectory || trajectoryDetail?._id !== selectedTrajectory._id) {
            return [];
        }

        return trajectoryDetail.frames ?? [];
    }, [selectedTrajectory, trajectoryDetail]);

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

    // Drop a trajectory from the URL only once the listing has loaded without it.
    const isTrajectoryListReady = trajectoryQuery.isSuccess;
    useEffect(() => {
        if (!selectedTrajectoryId || !isTrajectoryListReady) {
            return;
        }

        if (!selectedTrajectory) {
            updateSearchParams({
                [DEBUG_TRAJECTORY_PARAM]: null,
                [DEBUG_TIMESTEP_PARAM]: null
            }, true);
        }
    }, [isTrajectoryListReady, selectedTrajectory, selectedTrajectoryId, updateSearchParams]);

    // Likewise, drop a timestep only once the selected trajectory's frames have loaded without it.
    const areFramesReady = trajectoryDetailQuery.isSuccess && trajectoryDetail?._id === selectedTrajectoryId;
    useEffect(() => {
        if (!selectedTimestepParam) {
            return;
        }

        if (selectedTimestep === null) {
            updateSearchParams({ [DEBUG_TIMESTEP_PARAM]: null }, true);
            return;
        }

        if (!areFramesReady) {
            return;
        }

        const hasSelectedFrame = frames.some((frame) => frame.timestep === selectedTimestep);
        if (!hasSelectedFrame) {
            updateSearchParams({ [DEBUG_TIMESTEP_PARAM]: null }, true);
        }
    }, [areFramesReady, frames, selectedTimestep, selectedTimestepParam, updateSearchParams]);

    return {
        trajectories,
        frames,
        selectedTrajectory,
        selectedTrajectoryId,
        selectedTimestep,
        setSelectedTrajectory,
        setSelectedTimestep,
        isLoading: trajectoryQuery.isLoading,
        areFramesLoading: trajectoryDetailQuery.isLoading
    };
};

export default useDebugTrajectorySelector;
