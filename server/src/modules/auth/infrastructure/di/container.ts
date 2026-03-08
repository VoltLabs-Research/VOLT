import 'reflect-metadata';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import AuthSessionService from '@modules/auth/services/AuthSessionService';
import AvatarService from '@modules/auth/services/AvatarService';
import BcryptPasswordHasher from '@modules/auth/services/BcryptPasswordHasher';
import JwtTokenService from '@modules/auth/services/JwtTokenService';
import { container } from 'tsyringe';

export const registerAuthDependencies = () => {
    container.registerSingleton(AUTH_TOKENS.UserRepository, UserRepository);
    container.registerSingleton(AUTH_TOKENS.AvatarService, AvatarService);
    container.registerSingleton(AUTH_TOKENS.PasswordHasher, BcryptPasswordHasher);
    container.registerSingleton(AUTH_TOKENS.TokenService, JwtTokenService);
    container.registerSingleton(AUTH_TOKENS.AuthSessionService, AuthSessionService);
};
