import { TrajectoryProps } from '@modules/trajectory/entities/trajectory/Trajectory';

export interface CreateTrajectoryOutputDTO extends TrajectoryProps {
    _id: string;
}
