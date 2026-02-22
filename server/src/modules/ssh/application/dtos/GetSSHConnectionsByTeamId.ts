import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';

export interface GetSSHConnectionsByTeamIdInputDTO{
    teamId: string;
    page?: number;
    limit?: number;
};

export interface GetSSHConnectionsByTeamIdOutputDTO extends PaginatedResult<SSHConnectionProps>{}
