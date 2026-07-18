import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { inject } from 'tsyringe';
import type { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { AIConversationDTO } from '@modules/ai/application/dtos/ListAIConversationsDTO';
import { UpdateAIConversationInputDTO } from '@modules/ai/application/dtos/UpdateAIConversationDTO';
import type { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class UpdateAIConversationUseCase implements IUseCase<UpdateAIConversationInputDTO, AIConversationDTO> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository) private readonly conversationRepository: IAIConversationRepository
    ) {}

    async execute(input: UpdateAIConversationInputDTO): Promise<AIConversationDTO> {
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

        const updateData: Partial<AIConversationProps> = {};
        if (typeof input.title !== 'undefined') updateData.title = input.title.trim();
        if (typeof input.isArchived !== 'undefined') updateData.isArchived = input.isArchived;

        const updatedConversation = await this.conversationRepository.updateById(conversation._id, updateData);

        if (!updatedConversation) {
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        return {
            _id: updatedConversation._id,
            ...updatedConversation.props
        };
    }
}
