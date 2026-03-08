import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory'

export interface CreateTrajectoryInputDTO {
    formData: FormData;
    onProgress?: (progress: number) => void;
}

export interface CreateTrajectoryOutputDTO {
    trajectory: Trajectory;
}
