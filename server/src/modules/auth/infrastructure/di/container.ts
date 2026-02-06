import 'reflect-metadata';
import { container } from 'tsyringe';
import { AUTH_TOKENS } from './AuthTokens';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import AvatarService from '@modules/auth/infrastructure/security/AvatarService';
import BcryptPasswordHasher from '@modules/auth/infrastructure/security/BcryptPasswordHasher';
import JwtTokenService from '@modules/auth/infrastructure/security/JwtTokenService';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';

export const registerAuthDependencies = () => {
    container.registerSingleton(AUTH_TOKENS.UserRepository, UserRepository);
    container.registerSingleton(AUTH_TOKENS.SessionRepository, SessionRepository);
    container.registerSingleton(AUTH_TOKENS.AvatarService, AvatarService);
    container.registerSingleton(AUTH_TOKENS.BcryptPasswordHasher, BcryptPasswordHasher);
    container.registerSingleton(AUTH_TOKENS.JwtTokenService, JwtTokenService);
};