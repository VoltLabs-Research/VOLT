import { SESSION_CONTRACT_TOKENS } from '@shared/contracts/tokens/SessionTokens';

export const SESSION_TOKENS = Object.freeze({
    SessionRepository: SESSION_CONTRACT_TOKENS.SessionRepository,
    SessionService: Symbol.for('SessionService')
});
