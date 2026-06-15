export interface TokenPayload{
    id: string;
    iat?: number;
    exp?: number;
}

export interface ITokenService{
    sign(userId: string): string;

    verify(token: string): TokenPayload | null;
}
