export interface RevokeAllSessionsInputDTO{
    userId: string;
    token: string;
};

export interface RevokeAllSessionsOutputDTO{
    revokedCount: number;
};