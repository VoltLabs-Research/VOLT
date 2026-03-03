import { injectable, inject } from 'tsyringe';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import { ISessionRepository } from '@modules/session/domain/ports/ISessionRepository';

@injectable()
export default class UserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    constructor(
        @inject(SESSION_TOKENS.SessionRepository)
        protected readonly repository: ISessionRepository
    ){
        super();
    }
}
