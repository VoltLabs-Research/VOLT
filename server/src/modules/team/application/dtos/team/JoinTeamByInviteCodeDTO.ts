import { UserScopedInputDTO, MessageOutputDTO } from '@modules/team/application/dtos/common';

export interface JoinTeamByInviteCodeInputDTO extends UserScopedInputDTO {
    code: string;
};

export type JoinTeamByInviteCodeOutputDTO = MessageOutputDTO;
