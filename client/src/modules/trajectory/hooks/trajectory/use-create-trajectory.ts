import { createTrajectoryUploadSessionMutation } from './queries';
import { useCallback } from 'react';
import type {
    CreateTrajectoryInputDTO,
    CreateTrajectoryUploadSessionOutputDTO
} from '../../api/services/trajectory-service';

export default function useCreateTrajectory() {
    const mutation = createTrajectoryUploadSessionMutation();

    const createTrajectory = useCallback(async (
        input: CreateTrajectoryInputDTO
    ): Promise<CreateTrajectoryUploadSessionOutputDTO> => {
        return mutation.mutateAsync(input);
    }, [mutation]);

    return createTrajectory;
}
