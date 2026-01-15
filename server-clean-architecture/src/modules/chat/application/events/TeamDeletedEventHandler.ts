import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import TeamDeletedEvent from '@/src/modules/team/domain/events/TeamDeletedEvent';
import { CHAT_TOKENS } from '../../infrastructure/di/ChatTokens';
import { IChatRepository } from '../../domain/port/IChatRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private readonly chatRepository: IChatRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;

        await this.chatRepository.deleteMany({ team: teamId });
    }
};