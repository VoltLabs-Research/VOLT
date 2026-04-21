import { ErrorCodes } from '@core/constants/error-codes';
import type { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { UpdateAIConversationInputDTO } from '@modules/ai/application/dtos/UpdateAIConversationDTO';
import { AIConversationDTO } from '@modules/ai/application/dtos/ListAIConversationsDTO';
import { inject, injectable } from 'tsyringe';

interface UpdateAIConversationLookup {
    _id: string;
    teamId: string;
    userId: string;
};

@injectable()
export default class UpdateAIConversationUseCase implements IUseCase<UpdateAIConversationInputDTO, AIConversationDTO, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository
    ) {}

    async execute(input: UpdateAIConversationInputDTO): Promise<Result<AIConversationDTO, ApplicationError>> {
        const conversation = await this.conversationRepository.findOne({
            _id: input.conversationId,
            teamId: input.teamId,
            userId: input.userId
        } as UpdateAIConversationLookup);

        if (!conversation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            ));
        }

        const updateData: Partial<AIConversationProps> = {};
        if (typeof input.title !== 'undefined') updateData.title = input.title.trim();
        if (typeof input.isArchived !== 'undefined') updateData.isArchived = input.isArchived;

        const updatedConversation = await this.conversationRepository.updateById(conversation._id, updateData);

        if (!updatedConversation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            ));
        }

        return Result.ok({
            _id: updatedConversation._id,
            ...updatedConversation.props
        });
    }
};
