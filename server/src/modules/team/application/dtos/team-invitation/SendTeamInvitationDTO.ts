import { EntityOutputDTO, TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';

export interface SendTeamInvitationInputDTO extends TeamUserScopedInputDTO {
    email: string;
    roleId?: string;
};

export type SendTeamInvitationOutputDTO = EntityOutputDTO<TeamInvitationProps>;
