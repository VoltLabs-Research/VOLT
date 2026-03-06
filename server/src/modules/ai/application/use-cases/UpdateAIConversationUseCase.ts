import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import {
    UpdateAIConversationInputDTO,
    UpdateAIConversationOutputDTO
} from '@modules/ai/application/dtos/UpdateAIConversationDTO';

@injectable()
export default class UpdateAIConversationUseCase implements IUseCase<UpdateAIConversationInputDTO, UpdateAIConversationOutputDTO, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository
    ) {}

    async execute(input: UpdateAIConversationInputDTO): Promise<Result<UpdateAIConversationOutputDTO, ApplicationError>> {
        const conversation = await this.conversationRepository.findOne({
            _id: input.conversationId,
            teamId: input.teamId,
            userId: input.userId
        } as any);

        if (!conversation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            ));
        }

        const updateData: any = {};
        if (typeof input.title !== 'undefined') updateData.title = input.title.trim();
        if (typeof input.isArchived !== 'undefined') updateData.isArchived = input.isArchived;
        if (typeof input.lastProvider !== 'undefined') updateData.lastProvider = input.lastProvider;
        if (typeof input.lastModel !== 'undefined') updateData.lastModel = input.lastModel;
        if (typeof input.lastMessageAt !== 'undefined') {
            updateData.lastMessageAt = input.lastMessageAt ? new Date(input.lastMessageAt) : null;
        }

        const updatedConversation = await this.conversationRepository.updateById(conversation.id, updateData);

        if (!updatedConversation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            ));
        }

        return Result.ok({
            _id: updatedConversation.id,
            ...updatedConversation.props
        });
    }
}
