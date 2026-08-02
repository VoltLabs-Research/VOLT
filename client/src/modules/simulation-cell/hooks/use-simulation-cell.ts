import { simulationCellByTrajectoryQuery } from './queries';
import type { SimulationCell } from '@volt/contracts/modules/simulation-cell/domain';
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

const useSimulationCell = ({
    trajectoryId,
    timestep,
    enabled = true
}: UseSimulationCellParams = {}): UseSimulationCellResult => {
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
            enabled: enabled && Boolean(trajectoryId),
            retry: (failureCount, error) => {
                if (isAccessDeniedError(error)) {
                    return false;
                }

                return failureCount < 2;
            }
        }
    );

    const accessDenied = isAccessDeniedError(queryError);

    return {
        simulationCell: data ?? null,
        isLoading,
        accessDenied,
        accessDeniedMessage: accessDenied
            ? reportError(queryError, { surface: ErrorSurface.Silent }).title
            : undefined
    };
};

export default useSimulationCell;
