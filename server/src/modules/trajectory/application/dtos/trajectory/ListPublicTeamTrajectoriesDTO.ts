import { TrajectoryPersistedDTO } from './GetTrajectoriesByTeamIdDTO';
import { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface PublicTeamDiscoveryDTO {
    _id: string;
    name: string;
}

export interface ListPublicTeamTrajectoriesInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
}

export interface ListPublicTeamTrajectoriesOutputDTO extends PaginatedResult<TrajectoryPersistedDTO> {
    _meta: {
        team: PublicTeamDiscoveryDTO;
    };
}
