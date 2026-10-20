export interface TeamScopedSocketPayload {
    teamId: string;
}

export interface SubscribeToTeamSocketPayload extends TeamScopedSocketPayload {
    previousTeamId?: string;
}
