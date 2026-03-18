export interface PreviewJoinByInviteCodeInputDTO {
    code: string;
};

export interface PreviewJoinByInviteCodeOutputDTO {
    message: string;
    teamId: string;
    teamName: string;
    ownerName: string;
    isAlreadyMember: boolean;
};
