import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO } from '@modules/chat/application/dtos/chat/GetOrCreateChatDTO';
import { injectable, inject } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { toPersistedChatOutput } from '@modules/chat/application/helpers/toPersistedChatOutput';
import { ErrorCodes } from '@core/constants/error-codes';

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
