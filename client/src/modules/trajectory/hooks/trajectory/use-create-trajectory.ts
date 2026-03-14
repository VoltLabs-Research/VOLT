import { trajectoryQuery } from './queries';
import { useCallback } from 'react';
import type { Trajectory } from '../../api/entities/trajectory';

export default function useCreateTrajectory() {
    const mutation = trajectoryQuery.useCreateMutation();

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
