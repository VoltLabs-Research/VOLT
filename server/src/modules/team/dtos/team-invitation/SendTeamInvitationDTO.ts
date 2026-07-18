import { EntityOutputDTO, TeamUserScopedInputDTO } from '@modules/team/dtos/common';
import { TeamInvitationProps } from '@modules/team/entities/team-invitation/TeamInvitation';

export interface SendTeamInvitationInputDTO extends TeamUserScopedInputDTO {
    email: string;
    roleId?: string;
};

export type SendTeamInvitationOutputDTO = EntityOutputDTO<TeamInvitationProps>;
