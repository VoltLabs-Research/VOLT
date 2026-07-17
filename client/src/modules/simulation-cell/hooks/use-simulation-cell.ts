import { simulationCellByTrajectoryQuery } from './queries';
import type { SimulationCell } from '../api/types/simulation-cell';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';

interface UseSimulationCellParams {
    trajectoryId?: string;
    timestep?: number;
    enabled?: boolean;
};

interface UseSimulationCellResult {
    simulationCell: SimulationCell | null;
    isLoading: boolean;
    accessDenied: boolean;
    accessDeniedMessage: string | undefined;
};

const useSimulationCell = (params: UseSimulationCellParams = {}): UseSimulationCellResult => {
    const { trajectoryId, timestep, enabled = true } = params;

    const shouldFetch = enabled && Boolean(trajectoryId);

    const {
        data,
        isLoading,
        error: queryError
    } = simulationCellByTrajectoryQuery(
        {
            trajectoryId: trajectoryId || '',
            timestep
        },
        {
            enabled: shouldFetch,
            retry: (failureCount, error) => {
                if (isAccessDeniedError(error)) {
                    return false;
                }

                return failureCount < 2;
            }
        }
    );

    const simulationCell = data ?? null;
    const accessDenied = isAccessDeniedError(queryError);
    const accessDeniedMessage = accessDenied
        ? reportError(queryError, { surface: ErrorSurface.Silent }).title
        : undefined;

    return {
        simulationCell,
        isLoading,
        accessDenied,
        accessDeniedMessage
    };
};

export default useSimulationCell;
