import { useTrajectoryByIdQuery } from './queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { Trajectory } from '../../api/entities/trajectory';

interface UseGetTrajectoryByIdParams {
    trajectoryId?: string;
    enabled?: boolean;
};

interface UseGetTrajectoryByIdResult {
    trajectory: Trajectory | null;
    isLoading: boolean;
    error: string | null;
    isReady: boolean;
    accessDenied: boolean;
    accessDeniedMessage: string | undefined;
    refetch: () => Promise<void>;
};

export default function useGetTrajectoryById(params: UseGetTrajectoryByIdParams = {}): UseGetTrajectoryByIdResult {
    const { trajectoryId, enabled = true } = params;
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const shouldFetch = enabled && Boolean(trajectoryId);

    const {
        data,
        isLoading,
        error: queryError,
        refetch
    } = useTrajectoryByIdQuery(
        { trajectoryId: trajectoryId || '' },
        {
            enabled: shouldFetch,
            retry: (failureCount, error) => {
                if (checkAccessDeniedError(error)) {
                    return false;
                }
                return failureCount < 2;
            }
        }
    );

    const trajectory = data ?? null;

    let errorMessage: string | null = null;
    if (queryError) {
        if (!checkAccessDeniedError(queryError)) {
            errorMessage = queryError.message || 'Failed to fetch trajectory';
        }
    }

    const handleRefetch = async (): Promise<void> => {
        await refetch();
    };

    return {
        trajectory,
        isLoading,
        error: errorMessage,
        isReady: Boolean(trajectory) && trajectory?._id === trajectoryId && !isLoading,
        accessDenied,
        accessDeniedMessage,
        refetch: handleRefetch
    };
}
