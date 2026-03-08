import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

export interface CreateTrajectoryInputDTO {
    formData: FormData;
    onProgress?: (progress: number) => void;
};

export type CreateTrajectoryOutputDTO = Trajectory;
