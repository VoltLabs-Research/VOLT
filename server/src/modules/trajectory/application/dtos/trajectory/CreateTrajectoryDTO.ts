import { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export interface CreateTrajectoryOutputDTO extends TrajectoryProps {
    _id: string;
}
