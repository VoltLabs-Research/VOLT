import { MessageOutputDTO, UserScopedInputDTO } from '@modules/team/dtos/common';

export interface PreviewJoinTeamByInviteCodeInputDTO extends UserScopedInputDTO {
    code: string;
};

export interface PreviewJoinTeamByInviteCodeOutputDTO extends MessageOutputDTO {
    teamId: string;
    teamName: string;
    ownerName: string;
    isAlreadyMember: boolean;
};
