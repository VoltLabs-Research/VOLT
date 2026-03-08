import { GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO } from '@modules/chat/application/dtos/chat/GetOrCreateChatDTO';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { toPersistedChatOutput } from '@modules/chat/domain/services/toPersistedChatOutput';
import { ErrorCodes } from '@core/constants/error-codes';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';

@injectable()
export class GetOrCreateChatUseCase implements IUseCase<GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ){}

    async execute(input: GetOrCreateChatInputDTO): Promise<Result<GetOrCreateChatOutputDTO, ApplicationError>> {
        const { userId, targetUserId, teamId } = input;

        if (userId === targetUserId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.CHAT_INVALID_ACTION,
                'Cannot create chat with yourself'
            ));
        }

        const result = await this.chatRepo.findOrCreateChat(userId, targetUserId, teamId);
        return Result.ok(toPersistedChatOutput(result));
    }
};
