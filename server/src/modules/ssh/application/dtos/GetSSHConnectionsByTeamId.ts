import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';

export interface GetSSHConnectionsByTeamIdInputDTO{
    teamId: string;
    page?: number;
    limit?: number;
};

export interface GetSSHConnectionsByTeamIdOutputDTO extends PaginatedResult<SSHConnectionProps>{}
