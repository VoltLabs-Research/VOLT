import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { inject, injectable } from 'tsyringe';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';

@injectable()
export default class UserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    constructor(
        @inject(SESSION_TOKENS.SessionRepository)
        protected readonly repository: ISessionRepository
    ){
        super();
    }
};
