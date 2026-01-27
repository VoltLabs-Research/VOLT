export interface CreateTeamPayload {
    name: string;
    description?: string;
}

export interface UpdateTeamPayload {
    name?: string;
    description?: string;
}
