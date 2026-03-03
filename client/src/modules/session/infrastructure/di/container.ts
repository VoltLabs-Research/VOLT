import { container } from 'tsyringe';
import type ISessionRepository from '@/modules/session/domain/ports/ISessionRepository';
import SessionRepository from '@/modules/session/infrastructure/repositories/SessionRepository';
import { SESSION_TOKENS } from './tokens';

export const ensureSessionDI = () => {
    container.register<ISessionRepository>(SESSION_TOKENS.SessionRepository, SessionRepository);
};
