import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { inject, injectable } from 'tsyringe';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';

@injectable()
export default class UserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        protected readonly repository: IChatRepository
    ){
        super();
    }
};
