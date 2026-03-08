import { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export interface GetTrajectoryByIdInputDTO {
    trajectoryId: string;
};

export interface GetTrajectoryByIdOutputDTO extends TrajectoryProps {
    _id: string;
};
