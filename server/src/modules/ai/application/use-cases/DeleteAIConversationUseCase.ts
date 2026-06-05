import type { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import { inject } from 'tsyringe';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteAIConversationInputDTO } from '@modules/ai/application/dtos/DeleteAIConversationDTO';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface DeleteAIConversationLookup {
    _id: string;
    teamId: string;
    userId: string;
}

@Singleton()
export default class DeleteAIConversationUseCase implements IUseCase<DeleteAIConversationInputDTO, null, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository) private readonly conversationRepository: IAIConversationRepository,
        @inject(AI_TOKENS.AIMessageRepository) private readonly messageRepository: IAIMessageRepository
    ) {}

    async execute(input: DeleteAIConversationInputDTO): Promise<Result<null, ApplicationError>> {
        const conversation = await this.conversationRepository.findOne({
            _id: input.conversationId,
            teamId: input.teamId,
            userId: input.userId
        } as DeleteAIConversationLookup);

        if (!conversation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            ));
        }

        await this.messageRepository.deleteMany({
            conversationId: conversation._id
        });

        await this.conversationRepository.deleteById(conversation._id);

        return Result.ok(null);
    }
}
