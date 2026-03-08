import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { TrajectoryProps } from '@modules/trajectory/domain/entities/Trajectory';

export interface TrajectoryPersistedDTO extends TrajectoryProps {
    _id: string;
}

export interface GetTrajectoriesByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
};

export interface GetTrajectoriesByTeamIdOutputDTO extends PaginatedResult<TrajectoryPersistedDTO> { };
