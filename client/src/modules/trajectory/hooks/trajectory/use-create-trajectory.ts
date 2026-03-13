import { trajectoryQuery } from './queries';
import { handleActionError } from '@/shared/errors/handled-action';
import { useCallback } from 'react';
import type { Trajectory } from '../../api/entities/trajectory';

export default function useCreateTrajectory() {
    const mutation = trajectoryQuery.useCreateMutation();

    const createTrajectory = useCallback(async (
        formData: FormData,
        onProgress?: (progress: number) => void
    ): Promise<Trajectory | null> => {
        try {
            const result = await mutation.mutateAsync({
                formData,
                onProgress
            });
            return result;
        } catch (error) {
            handleActionError(error, {
                accessDeniedTitle: 'You do not have permission to create trajectories',
                errorToast: {
                    title: 'Failed to create trajectory',
                    description: 'Please check your files and try again.'
                }
            });
            return null;
        }
    }, [mutation]);

    return createTrajectory;
}
