import { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type DeleteTeamMemberByIdInputDTO = TeamScopedEntityIdInputDTO<'teamMemberId'>;
