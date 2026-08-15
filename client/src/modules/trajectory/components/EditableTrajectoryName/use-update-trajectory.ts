import { trajectoryQuery, TRAJECTORY_QUERY_KEYS } from '../../hooks/trajectory/queries';
import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import queryClient from '@/shared/query/query-client';
import { sileo } from 'sileo';
import { useCallback } from 'react';

interface UpdateTrajectoryPayload {
    name?: string;
    isPublic?: boolean;
}

export default function useUpdateTrajectory() {
    const mutation = trajectoryQuery.useUpdateMutation({
        onSuccess: (trajectory) => {
            queryClient.removeQueries({
                queryKey: TRAJECTORY_QUERY_KEYS.trajectory(trajectory._id)
            });
        }
    });

    const updateTrajectory = useCallback(async (_id: string, data: UpdateTrajectoryPayload) => {
        try {
            await mutation.mutateAsync({
                id: _id,
                params: data
            });
            sileo.success({ title: 'Trajectory updated' });
        } catch (error: unknown) {
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to update trajectory'
            });
            throw error;
        }
    }, [mutation]);

    return updateTrajectory;
}
