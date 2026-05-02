export interface TokenPayload{
    _id: string;
    userId: string;
    id: string;
    iat?: number;
    exp?: number;
}

export interface ITokenService{
    /**
     * Sign a new token for a user.
     */
    sign(userId: string): string;

    /**
     * Verify and decode a token.
     */
    verify(token: string): TokenPayload | null;
}
