import { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface TrajectoryPersistedDTO extends TrajectoryProps {
    _id: string;
};

export interface GetTrajectoriesByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    folderId?: string;
    search?: string;
};

export interface GetTrajectoriesByTeamIdOutputDTO extends PaginatedResult<TrajectoryPersistedDTO> { };
