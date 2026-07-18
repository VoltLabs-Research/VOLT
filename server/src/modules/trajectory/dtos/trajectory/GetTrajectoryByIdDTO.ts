import { TrajectoryProps } from '@modules/trajectory/entities/trajectory/Trajectory';

export interface GetTrajectoryByIdOutputDTO extends TrajectoryProps {
    _id: string;
};
