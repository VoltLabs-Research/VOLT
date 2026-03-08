interface AuthTokens {
    readonly UserRepository: symbol;
    readonly AvatarService: symbol;
    readonly PasswordHasher: symbol;
    readonly TokenService: symbol;
    readonly AuthSessionService: symbol;
}

export const AUTH_TOKENS: AuthTokens = {
    UserRepository: Symbol.for('UserRepository'),
    AvatarService: Symbol.for('AvatarService'),
    PasswordHasher: Symbol.for('PasswordHasher'),
    TokenService: Symbol.for('TokenService'),
    AuthSessionService: Symbol.for('AuthSessionService')
};
