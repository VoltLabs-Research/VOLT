import { useTrajectoryByIdQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { isTrajectoryCompleted } from '@/modules/trajectory/utils/trajectory-status';
import { isApiError } from '@/shared/errors/core/report-error';
import { applySearchParamUpdates } from '@/shared/ui/hooks/use-search-params';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

const DEBUG_TRAJECTORY_PARAM = 'debugTrajectory';
const DEBUG_TIMESTEP_PARAM = 'debugTimestep';

const readSelectedTimestep = (value: string | null): number | null => {
    if (!value) {
        return null;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
};

// A debug session steps through one frame, so the trajectory must be processed and have frames.
export const debugUnavailableReason = (trajectory: Trajectory): string | undefined => {
    if (trajectory.status === 'failed') return 'Processing failed';
    if (!isTrajectoryCompleted(trajectory.status)) return 'Still processing';
    if (!(trajectory.framesCount ?? trajectory.frames?.length)) return 'No frames';
    return undefined;
};

const useDebugTrajectorySelector = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const selectedTrajectoryId = searchParams.get(DEBUG_TRAJECTORY_PARAM) || null;
    const selectedTimestepParam = searchParams.get(DEBUG_TIMESTEP_PARAM);
    const selectedTimestep = readSelectedTimestep(selectedTimestepParam);

    // The listing has no frames, so the selected trajectory and its frames come from its detail.
    const trajectoryDetailQuery = useTrajectoryByIdQuery(selectedTrajectoryId ?? '', {
        enabled: Boolean(selectedTrajectoryId)
    });

    const updateSearchParams = useCallback((updates: Record<string, string | number | boolean | null | undefined>, replace = false) => {
        setSearchParams((prev) => applySearchParamUpdates(prev, updates), { replace });
    }, [setSearchParams]);

    const trajectoryDetail = trajectoryDetailQuery.data;
    const isDetailOfSelected = Boolean(selectedTrajectoryId) && trajectoryDetail?._id === selectedTrajectoryId;
    const selectedTrajectory = isDetailOfSelected && trajectoryDetail && !debugUnavailableReason(trajectoryDetail)
        ? trajectoryDetail
        : null;

    const frames = useMemo(() => selectedTrajectory?.frames ?? [], [selectedTrajectory]);

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

    // Drop a trajectory from the URL once its detail says it is gone or can't be debugged.
    const isSelectedGone = isApiError(trajectoryDetailQuery.error) && trajectoryDetailQuery.error.status === 404;
    const isSelectedUnusable = isDetailOfSelected && !selectedTrajectory;
    useEffect(() => {
        if (!isSelectedGone && !isSelectedUnusable) {
            return;
        }

        updateSearchParams({
            [DEBUG_TRAJECTORY_PARAM]: null,
            [DEBUG_TIMESTEP_PARAM]: null
        }, true);
    }, [isSelectedGone, isSelectedUnusable, updateSearchParams]);

    // Likewise, drop a timestep only once the selected trajectory's frames have loaded without it.
    const areFramesReady = selectedTrajectory !== null;
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
        frames,
        selectedTrajectory,
        selectedTrajectoryId,
        selectedTimestep,
        setSelectedTrajectory,
        setSelectedTimestep,
        areFramesLoading: trajectoryDetailQuery.isLoading
    };
};

export default useDebugTrajectorySelector;
