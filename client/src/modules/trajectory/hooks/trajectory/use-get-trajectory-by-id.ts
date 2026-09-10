import { useTrajectoryByIdQuery } from './queries';
import useAccessDenied, { createAccessDeniedRetry } from '@/shared/ui/hooks/use-access-denied';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface UseGetTrajectoryByIdParams {
    trajectoryId?: string;
    enabled?: boolean;
}

interface UseGetTrajectoryByIdResult {
    trajectory: Trajectory | null;
}

export default function useGetTrajectoryById(params: UseGetTrajectoryByIdParams = {}): UseGetTrajectoryByIdResult {
    const { trajectoryId, enabled = true } = params;
    const { checkAccessDeniedError } = useAccessDenied();

    const shouldFetch = enabled && Boolean(trajectoryId);

    const { data } = useTrajectoryByIdQuery(
        trajectoryId || '',
        {
            enabled: shouldFetch,
            refetchOnMount: 'always',
            retry: createAccessDeniedRetry(checkAccessDeniedError)
        }
    );

    const trajectory = data ?? null;

    return { trajectory };
}
