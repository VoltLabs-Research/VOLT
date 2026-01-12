import { PaginatedResult } from "@/src/shared/domain/ports/IBaseRepository";
import { TrajectoryProps } from "../../domain/entities/Trajectory";

export interface GetTrajectoriesByTeamIdInputDTO{
    teamId: string;
};

export interface GetTrajectoriesByTeamIdOutputDTO extends PaginatedResult<TrajectoryProps>{};