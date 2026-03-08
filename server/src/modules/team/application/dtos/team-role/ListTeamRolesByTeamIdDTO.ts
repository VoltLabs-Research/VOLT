import {
    PaginatedTeamScopedInputDTO,
    PersistedEntityDTO,
    TeamScopedPaginatedOutputDTO
} from '@modules/team/application/dtos/common';
import { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';

export type ListTeamRolesByTeamIdInputDTO = PaginatedTeamScopedInputDTO;

export type ListTeamRolesByTeamIdOutputDTO = TeamScopedPaginatedOutputDTO<PersistedEntityDTO<TeamRoleProps>>;
