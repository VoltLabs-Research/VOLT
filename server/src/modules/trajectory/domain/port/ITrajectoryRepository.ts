import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Trajectory, { TrajectoryProps } from '@modules/trajectory/domain/entities/Trajectory';

export interface ITrajectoryRepository extends IBaseRepository<Trajectory, TrajectoryProps> {
}