export interface TeamCreatedEventPayload{
    teamId: string;
    ownerId: string;
}

export interface TeamDeletedEventPayload{
    teamId: string;
    userId?: string;
}

export interface TeamMemberDeletedEventPayload{
    teamMemberId: string;
    teamId: string;
}

export interface TeamRoleCreatedEventPayload{
    teamRoleId: string;
    teamId: string;
    name: string;
    userId: string;
}

export interface TeamRoleDeletedEventPayload{
    teamRoleId: string;
    teamId: string;
    userId: string;
    roleName: string;
}

export interface TeamRoleUpdatedEventPayload{
    teamRoleId: string;
    teamId: string;
    name?: string;
    permissions?: string[];
}

export interface SecretKeyCreatedEventPayload{
    secretKeyId: string;
    teamId: string;
    name: string;
    userId: string;
}

export interface SecretKeyDeletedEventPayload{
    secretKeyId: string;
    teamId: string;
    userId: string;
    secretKeyName: string;
}

export interface InvitationSentEventPayload{
    teamName: string;
    invitedUserId: string;
    invitationId: string;
}
