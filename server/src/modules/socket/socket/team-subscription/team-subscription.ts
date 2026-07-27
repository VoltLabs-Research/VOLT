export interface TeamScopedSocketPayload {
    teamId: string;
}

export interface SubscribeToTeamSocketPayload extends TeamScopedSocketPayload {
    previousTeamId?: string;
}

export interface NormalizedTeamSubscription {
    teamId: string;
    previousTeamId?: string;
    roomName: string;
    previousRoomName?: string;
}
