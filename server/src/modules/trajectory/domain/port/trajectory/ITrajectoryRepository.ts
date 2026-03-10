import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Trajectory, { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export interface ITrajectoryRepository extends IBaseRepository<Trajectory, TrajectoryProps> {
    createWithId(id: string, data: Partial<TrajectoryProps>): Promise<Trajectory>;
};
