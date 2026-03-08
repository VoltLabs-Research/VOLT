export const AUTH_TOKENS = {
    UserRepository: Symbol.for('UserRepository'),
    AvatarService: Symbol.for('AvatarService'),
    PasswordHasher: Symbol.for('PasswordHasher'),
    TokenService: Symbol.for('TokenService'),
    AuthSessionService: Symbol.for('AuthSessionService')
} as const;
