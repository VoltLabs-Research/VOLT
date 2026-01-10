import 'reflect-metadata';
import { container } from 'tsyringe';
import { SESSION_TOKENS } from './SessionTokens';
import SessionRepository from '../persistence/mongo/repositories/SessionRepository';

container.registerSingleton(SESSION_TOKENS.SessionRepository, SessionRepository);