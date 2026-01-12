import { TrajectoryProps } from "../../domain/entities/Trajectory";

export interface GetTrajectoryByIdInputDTO{
    trajectoryId: string;
};

export interface GetTrajectoryByIdOutputDTO extends TrajectoryProps{};