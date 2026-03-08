import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { SafeSSHConnectionDTO } from '@modules/ssh/application/dtos/CreateSSHConnectionDTO';

export interface GetSSHConnectionsByTeamIdInputDTO{
    teamId: string;
    page?: number;
    limit?: number;
};

export interface GetSSHConnectionsByTeamIdOutputDTO extends PaginatedResult<SafeSSHConnectionDTO>{}
