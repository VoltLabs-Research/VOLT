export interface TokenPayload{
    id: string;
    iat?: number;
    exp?: number;
};

export interface ITokenService{
    /**
     * Sign a new token for a user.
     */
    sign(id: string): string;

    /**
     * Verify and decode a token.
     */
    verify(token: string): TokenPayload | null;
};