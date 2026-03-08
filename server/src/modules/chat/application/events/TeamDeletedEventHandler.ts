import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { inject, injectable } from 'tsyringe';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        protected readonly repository: IChatRepository
    ) {
        super();
    }
};
