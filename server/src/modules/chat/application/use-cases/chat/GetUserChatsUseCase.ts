import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { GetUserChatsInputDTO, GetUserChatsOutputDTO } from '@modules/chat/application/dtos/chat/GetUserChatsDTO';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';

@injectable()
export class GetUserChatsUseCase implements IUseCase<GetUserChatsInputDTO, GetUserChatsOutputDTO[], ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
    ){}

    async execute(input: GetUserChatsInputDTO): Promise<Result<GetUserChatsOutputDTO[], ApplicationError>> {
        const result = await this.chatRepo.findChatsByUserId(input.userId);
        return Result.ok(result);
    }
};
