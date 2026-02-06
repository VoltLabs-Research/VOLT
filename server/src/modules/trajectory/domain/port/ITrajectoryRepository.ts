import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import Trajectory, { TrajectoryProps } from '@modules/trajectory/domain/entities/Trajectory';

export interface ITrajectoryRepository extends IBaseRepository<Trajectory, TrajectoryProps> {
}