import 'reflect-metadata';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const sessionDIManifest: ModuleManifest = {
    name: 'session',
    singletons: [[SESSION_TOKENS.SessionRepository, SessionRepository]]
};
