import { TrajectoryProps } from "../../../domain/entities/Trajectory";

export interface UpdateTrajectoryByIdInputDTO {
    trajectoryId: string;
    name: string;
    isPublic: boolean;
};

export interface UpdateTrajectoryByIdOutputDTO extends TrajectoryProps { };