import { trajectoryQuery } from './queries';
import { handleActionError } from '@/shared/errors/handled-action';
import { sileo } from 'sileo';
import { useCallback } from 'react';

interface UpdateTrajectoryPayload {
    name?: string;
    isPublic?: boolean;
};

export default function useUpdateTrajectory() {
    const mutation = trajectoryQuery.useUpdateMutation();

    const updateTrajectory = useCallback(async (_id: string, data: UpdateTrajectoryPayload) => {
        try {
            await mutation.mutateAsync({ id: _id, params: data });
            sileo.success({ title: 'Trajectory updated' });
        } catch (error) {
            handleActionError(error, {
                accessDeniedTitle: 'You do not have permission to update this trajectory',
                errorToast: { title: 'Failed to update trajectory' }
            });
            throw error;
        }
    }, [mutation]);

    return updateTrajectory;
}
