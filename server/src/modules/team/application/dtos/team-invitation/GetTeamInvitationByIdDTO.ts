import {
    EntityOutputDTO,
    EntityIdInputDTO,
} from '@modules/team/application/dtos/common';
import { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';

export type GetTeamInvitationByIdInputDTO = EntityIdInputDTO<'invitationId'>;

export type GetTeamInvitationByIdOutputDTO = EntityOutputDTO<TeamInvitationProps>;
