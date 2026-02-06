import type { Trajectory } from '../../../domain/entities';

export interface CreateTrajectoryInputDTO{
    formData: FormData;
    onProgress?: (progress: number) => void;
};

export interface CreateTrajectoryOutputDTO{
    trajectory: Trajectory;
};
