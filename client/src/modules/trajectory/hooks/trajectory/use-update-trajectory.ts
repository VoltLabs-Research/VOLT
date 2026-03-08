import { trajectoryQuery } from './queries';
import ApiError from '@/shared/errors/ApiError';
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
            if (ApiError.isRBACError(error)) {
                const message = error instanceof ApiError
                    ? error.getFriendlyMessage()
                    : 'You do not have permission to update this trajectory';
                sileo.error({ title: message });
            } else {
                sileo.error({ title: 'Failed to update trajectory' });
            }
            throw error;
        }
    }, [mutation]);

    return updateTrajectory;
}
