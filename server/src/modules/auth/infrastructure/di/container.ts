import 'reflect-metadata';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import AuthSessionService from '@modules/auth/infrastructure/services/AuthSessionService';
import AvatarService from '@modules/auth/infrastructure/services/AvatarService';
import BcryptPasswordHasher from '@modules/auth/infrastructure/services/BcryptPasswordHasher';
import JwtTokenService from '@modules/auth/infrastructure/services/JwtTokenService';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerAuthDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [AUTH_TOKENS.UserRepository, UserRepository],
            [AUTH_TOKENS.AvatarService, AvatarService],
            [AUTH_TOKENS.PasswordHasher, BcryptPasswordHasher],
            [AUTH_TOKENS.TokenService, JwtTokenService],
            [AUTH_TOKENS.AuthSessionService, AuthSessionService]
        ]
    });
};
