import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { GetUserChatsInputDTO, GetUserChatsOutputDTO } from '@modules/chat/application/dtos/chat/GetUserChatsDTO';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

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