import queryClient from '@/shared/infrastructure/query/query-client';
import type { Trajectory } from '../api/entities/trajectory';

const TRAJECTORY_DETAIL_QUERY_KEY = ['trajectory', 'detail'] as const;

export const patchTrajectoryDetailCaches = (updater: (trajectory: Trajectory) => Trajectory): void => {
    queryClient.setQueriesData<Trajectory>(
        { queryKey: TRAJECTORY_DETAIL_QUERY_KEY },
        (current) => current ? updater(current) : current
    );
};
