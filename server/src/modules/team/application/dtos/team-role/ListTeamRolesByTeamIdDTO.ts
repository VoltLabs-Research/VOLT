import { PaginatedResult, PaginationOptions } from '@shared/domain/ports/IBaseRepository';
import { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';

export interface ListTeamRolesByTeamIdInputDTO extends PaginationOptions{
    teamId: string;
};

export interface ListTeamRolesByTeamIdOutputDTO extends PaginatedResult<TeamRoleProps>{}