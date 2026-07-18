import { AUTH_CONTRACT_TOKENS } from '@shared/contracts/tokens/AuthTokens';

export const AUTH_TOKENS = Object.freeze({
    UserRepository: AUTH_CONTRACT_TOKENS.UserRepository,
    PasswordHasher: AUTH_CONTRACT_TOKENS.PasswordHasher,
    TokenService: AUTH_CONTRACT_TOKENS.TokenService,
    AvatarService: Symbol.for('AvatarService'),
    AuthSessionService: Symbol.for('AuthSessionService'),
    AuthService: Symbol.for('AuthService')
});
