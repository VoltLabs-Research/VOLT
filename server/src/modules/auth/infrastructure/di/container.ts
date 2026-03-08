import 'reflect-metadata';
import { container } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import AvatarService from '@modules/auth/infrastructure/security/AvatarService';
import BcryptPasswordHasher from '@modules/auth/infrastructure/security/BcryptPasswordHasher';
import JwtTokenService from '@modules/auth/infrastructure/security/JwtTokenService';
import AuthSessionService from '@modules/auth/application/services/AuthSessionService';

export const registerAuthDependencies = () => {
    container.registerSingleton(AUTH_TOKENS.UserRepository, UserRepository);
    container.registerSingleton(AUTH_TOKENS.AvatarService, AvatarService);
    container.registerSingleton(AUTH_TOKENS.PasswordHasher, BcryptPasswordHasher);
    container.registerSingleton(AUTH_TOKENS.TokenService, JwtTokenService);
    container.registerSingleton(AUTH_TOKENS.AuthSessionService, AuthSessionService);
};
