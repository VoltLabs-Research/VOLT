import type { Trajectory } from '../../../domain/entities';

export interface UpdateTrajectoryInputDTO{
    id: string;
    data: Partial<Trajectory>;
};

export type UpdateTrajectoryOutputDTO = Trajectory;
