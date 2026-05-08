import { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export interface GetTrajectoryByIdOutputDTO extends TrajectoryProps {
    _id: string;
};
