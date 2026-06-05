import { GetUserChatsInputDTO } from '@modules/chat/application/dtos/chat/GetUserChatsDTO';
import type { IChatRepository, PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetUserChatsUseCase implements IUseCase<GetUserChatsInputDTO, PersistedChatDTO[], ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository,
    ){}

    async execute(input: GetUserChatsInputDTO): Promise<Result<PersistedChatDTO[], ApplicationError>> {
        const result = await this.chatRepo.findChatsByUserId(input.userId);
        return Result.ok(result);
    }
}
