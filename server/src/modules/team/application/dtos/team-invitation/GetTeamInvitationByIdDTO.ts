import { EntityOutputDTO, EntityIdInputDTO } from '@modules/team/application/dtos/common';
import { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';

export type GetTeamInvitationByIdInputDTO = EntityIdInputDTO<'invitationId'>;

export type GetTeamInvitationByIdOutputDTO = EntityOutputDTO<TeamInvitationProps>;
