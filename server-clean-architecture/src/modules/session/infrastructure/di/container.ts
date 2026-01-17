import 'reflect-metadata';
import { container } from 'tsyringe';
import { SESSION_TOKENS } from './SessionTokens';
import SessionRepository from '../persistence/mongo/repositories/SessionRepository';

export const registerSessionDependencies = () => {
    container.registerSingleton(SESSION_TOKENS.SessionRepository, SessionRepository);
};