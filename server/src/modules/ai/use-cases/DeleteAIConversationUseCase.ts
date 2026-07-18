import type { IAIMessageRepository } from '@modules/ai/ports/IAIMessageRepository';
import { inject } from 'tsyringe';
import { AI_TOKENS } from '@modules/ai/di/AITokens';
import type { IAIConversationRepository } from '@modules/ai/ports/IAIConversationRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteAIConversationInputDTO } from '@modules/ai/dtos/DeleteAIConversationDTO';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class DeleteAIConversationUseCase implements IUseCase<DeleteAIConversationInputDTO, null> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository) private readonly conversationRepository: IAIConversationRepository,
        @inject(AI_TOKENS.AIMessageRepository) private readonly messageRepository: IAIMessageRepository
    ) {}

    async execute(input: DeleteAIConversationInputDTO): Promise<null> {
        const conversation = await this.conversationRepository.findOwnedByUser(
            input.conversationId,
            input.teamId,
            input.userId
        );

        if (!conversation) {
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        await this.messageRepository.deleteMany({
            conversationId: conversation._id
        });

        await this.conversationRepository.deleteById(conversation._id);

        return null;
    }
}
