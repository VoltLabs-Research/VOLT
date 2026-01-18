import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { TrajectoryProps } from '@modules/trajectory/domain/entities/Trajectory';

export interface GetTrajectoriesByTeamIdInputDTO {
    teamId: string;
};

export interface GetTrajectoriesByTeamIdOutputDTO extends PaginatedResult<TrajectoryProps> { };