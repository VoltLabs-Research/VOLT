import { simulationCellByTrajectoryQuery } from './queries';
import type { SimulationCell } from '../api/entities/simulation-cell';
import { getAccessDeniedMessage, isAccessDeniedError } from '@/shared/errors/notify-api-error';

interface UseSimulationCellParams {
    trajectoryId?: string;
    timestep?: number;
    enabled?: boolean;
};

interface UseSimulationCellResult {
    simulationCell: SimulationCell | null;
    isLoading: boolean;
    error: string | null;
    isReady: boolean;
    accessDenied: boolean;
    accessDeniedMessage: string | undefined;
    refetch: () => Promise<void>;
};

const useSimulationCell = (params: UseSimulationCellParams = {}): UseSimulationCellResult => {
    const { trajectoryId, timestep, enabled = true } = params;

    const shouldFetch = enabled && Boolean(trajectoryId);

    const {
        data,
        isLoading,
        error: queryError,
        refetch
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
        ? getAccessDeniedMessage(queryError)
        : undefined;

    let errorMessage: string | null = null;
    if (queryError && !accessDenied) {
        errorMessage = queryError.message || 'Failed to fetch simulation cell';
    }

    const handleRefetch = async (): Promise<void> => {
        await refetch();
    };

    return {
        simulationCell,
        isLoading,
        error: errorMessage,
        isReady: !isLoading,
        accessDenied,
        accessDeniedMessage,
        refetch: handleRefetch
    };
};

export default useSimulationCell;
