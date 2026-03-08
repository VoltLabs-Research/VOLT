import { PersistedEntityDTO, PaginatedTeamScopedInputDTO, TeamScopedPaginatedOutputDTO } from '@modules/team/application/dtos/common';
import { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';

export type GetPendingInvitationsInputDTO = PaginatedTeamScopedInputDTO;

export type GetPendingInvitationsOutputDTO = TeamScopedPaginatedOutputDTO<PersistedEntityDTO<TeamInvitationProps>>;
