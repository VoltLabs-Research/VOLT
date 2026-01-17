import 'reflect-metadata';
import { container } from 'tsyringe';
import { AUTH_TOKENS } from './AuthTokens';
import UserRepository from '../persistence/mongo/repositories/UserRepository';
import AvatarService from '../security/AvatarService';
import BcryptPasswordHasher from '../security/BcryptPasswordHasher';
import JwtTokenService from '../security/JwtTokenService';
import SessionRepository from '@/src/modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';

export const registerAuthDependencies = () => {
    container.registerSingleton(AUTH_TOKENS.UserRepository, UserRepository);
    container.registerSingleton(AUTH_TOKENS.SessionRepository, SessionRepository);
    container.registerSingleton(AUTH_TOKENS.AvatarService, AvatarService);
    container.registerSingleton(AUTH_TOKENS.BcryptPasswordHasher, BcryptPasswordHasher);
    container.registerSingleton(AUTH_TOKENS.JwtTokenService, JwtTokenService);
};