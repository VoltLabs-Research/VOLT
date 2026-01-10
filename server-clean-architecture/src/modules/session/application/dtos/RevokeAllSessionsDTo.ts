export interface RevokeAllSessionsInputDTO{
    userId: string;
    currentSessionId: string;
};

export interface RevokeAllSessionsOutputDTO{
    revokedCount: number;
};