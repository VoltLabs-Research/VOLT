export const AUTH_TOKENS = Object.freeze({
    UserRepository: Symbol.for('UserRepository'),
    PasswordHasher: Symbol.for('PasswordHasher'),
    TokenService: Symbol.for('TokenService'),
    AvatarService: Symbol.for('AvatarService'),
    AuthSessionService: Symbol.for('AuthSessionService')
});
