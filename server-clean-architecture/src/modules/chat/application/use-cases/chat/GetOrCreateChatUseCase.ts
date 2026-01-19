import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO } from '@modules/chat/application/dtos/chat/GetOrCreateChatDTO';
import { injectable, inject } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';

@injectable()
export class GetOrCreateChatUseCase implements IUseCase<GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ) { }

    async execute(input: GetOrCreateChatInputDTO): Promise<Result<GetOrCreateChatOutputDTO, ApplicationError>> {
        const { userId, targetUserId, teamId } = input;

        if (userId === targetUserId) {
            // Assuming ErrorCodes.SELF_CHAT_NOT_ALLOWED doesn't exist yet, using INVALID_INPUT or similar
            return Result.fail(ApplicationError.badRequest('INVALID_INPUT', 'Cannot create chat with yourself'));
        }

        const result = await this.chatRepo.findOrCreateChat(userId, targetUserId, teamId);
        return Result.ok(result.props);
    }
};