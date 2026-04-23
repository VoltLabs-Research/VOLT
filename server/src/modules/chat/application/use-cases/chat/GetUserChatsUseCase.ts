import { GetUserChatsInputDTO } from '@modules/chat/application/dtos/chat/GetUserChatsDTO';
import { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class GetUserChatsUseCase implements IUseCase<GetUserChatsInputDTO, PersistedChatDTO[], ApplicationError> {
    constructor(
        
        private chatRepo: ChatRepository,
    ){}

    async execute(input: GetUserChatsInputDTO): Promise<Result<PersistedChatDTO[], ApplicationError>> {
        const result = await this.chatRepo.findChatsByUserId(input.userId);
        return Result.ok(result);
    }
};
