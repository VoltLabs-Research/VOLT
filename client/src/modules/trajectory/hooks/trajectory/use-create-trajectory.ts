import { trajectoryQuery, TRAJECTORY_QUERY_KEYS } from './queries';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useCallback } from 'react';
import type { Trajectory } from '../../api/entities/trajectory';

export default function useCreateTrajectory() {
    const mutation = trajectoryQuery.useCreateMutation({
        onSuccess: (trajectory) => {
            queryClient.removeQueries({
                queryKey: TRAJECTORY_QUERY_KEYS.trajectory(trajectory._id)
            });
        }
    });

    const createTrajectory = useCallback(async (
        formData: FormData,
        onProgress?: (progress: number) => void
    ): Promise<Trajectory> => {
        return mutation.mutateAsync({
            formData,
            onProgress
        });
    }, [mutation]);

    return createTrajectory;
}
