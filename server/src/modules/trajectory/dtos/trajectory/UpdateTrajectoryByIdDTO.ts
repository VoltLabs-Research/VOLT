import { TrajectoryProps } from '@modules/trajectory/entities/trajectory/Trajectory';

export interface UpdateTrajectoryByIdInputDTO {
    trajectoryId: string;
    name: string;
    isPublic: boolean;
};

export interface UpdateTrajectoryByIdOutputDTO extends TrajectoryProps {
    _id: string;
};
