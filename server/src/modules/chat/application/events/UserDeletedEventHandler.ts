import { injectable, inject } from 'tsyringe';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';

@injectable()
export default class UserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        protected readonly repository: IChatRepository
    ){
        super();
    }
}
