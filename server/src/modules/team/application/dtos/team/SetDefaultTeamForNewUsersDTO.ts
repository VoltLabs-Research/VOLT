export interface SetDefaultTeamForNewUsersInputDTO {
    teamId: string;
    enabled: boolean;
}

export interface SetDefaultTeamForNewUsersOutputDTO {
    defaultTeam: string | null;
    autoJoinNewMembers: boolean;
}
