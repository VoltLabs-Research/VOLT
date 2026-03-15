import { UserScopedInputDTO, MessageOutputDTO } from '@modules/team/application/dtos/common';

export interface JoinTeamByInviteCodeInputDTO extends UserScopedInputDTO {
    code: string;
};

export interface JoinTeamByInviteCodeOutputDTO extends MessageOutputDTO {
    teamId: string;
};
