import { TrajectoryProps } from "../../domain/entities/Trajectory";

export interface CreateTrajectoryInputDTO{
    name: string;
    files: any[],
    userId: string;
};

export interface CreateTrajectoryOutputDTO extends TrajectoryProps{};