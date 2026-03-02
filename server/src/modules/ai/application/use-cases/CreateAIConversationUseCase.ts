import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { IAIConversationRepository } from '@modules/ai/domain/ports/IAIConversationRepository';
import {
    CreateAIConversationInputDTO,
    CreateAIConversationOutputDTO
} from '@modules/ai/application/dtos/CreateAIConversationDTO';

@injectable()
export default class CreateAIConversationUseCase implements IUseCase<CreateAIConversationInputDTO, CreateAIConversationOutputDTO, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository
    ) {}

    async execute(input: CreateAIConversationInputDTO): Promise<Result<CreateAIConversationOutputDTO, ApplicationError>> {
        const title = input.title?.trim() || 'New Conversation';
        const conversation = await this.conversationRepository.create({
            teamId: input.teamId,
            userId: input.userId,
            title,
            isArchived: false,
            lastMessageAt: input.lastMessageAt ? new Date(input.lastMessageAt) : null,
            lastProvider: input.lastProvider || null,
            lastModel: input.lastModel || null
        } as any);

        return Result.ok({
            _id: conversation.id,
            ...conversation.props
        });
    }
}
