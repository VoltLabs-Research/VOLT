import 'reflect-metadata';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerSessionDependencies = () => {
    registerModuleDependencies({
        singletons: [[SESSION_TOKENS.SessionRepository, SessionRepository]]
    });
};
