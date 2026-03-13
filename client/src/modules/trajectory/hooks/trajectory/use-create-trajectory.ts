import { trajectoryQuery } from './queries';
import { ErrorSurface, reportError } from '@/shared/errors/core';
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
        } catch (error: unknown) {
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to create trajectory',
                fallbackDescription: 'Please check your files and try again.'
            });
            return null;
        }
    }, [mutation]);

    return createTrajectory;
}
