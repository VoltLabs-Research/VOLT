import 'reflect-metadata';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import { container } from 'tsyringe';

export const registerSessionDependencies = () => {
    container.registerSingleton(SESSION_TOKENS.SessionRepository, SessionRepository);
};
