import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { AI_TOKENS } from '@modules/ai/application/di/AITokens';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import AIMessageDTOMapper from '@modules/ai/application/services/AIMessageDTOMapper';
import {
    CreateAIConversationInputDTO,
    CreateAIConversationOutputDTO
} from '@modules/ai/application/dtos/CreateAIConversationDTO';

@injectable()
export default class CreateAIConversationUseCase implements IUseCase<CreateAIConversationInputDTO, CreateAIConversationOutputDTO, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository,

        @inject(AI_TOKENS.AIMessageRepository)
        private readonly messageRepository: IAIMessageRepository,

        @inject(AI_TOKENS.AIMessageDTOMapper)
        private readonly messageDTOMapper: AIMessageDTOMapper
    ) {}

    async execute(input: CreateAIConversationInputDTO): Promise<Result<CreateAIConversationOutputDTO, ApplicationError>> {
        const title = input.title?.trim() || 'New Conversation';
        const normalizedMessage = input.message?.trim();

        if (normalizedMessage && title !== normalizedMessage) {
            return Result.fail(ApplicationError.badRequest(
                'Validation::InvalidInput',
                'title must match the first message'
            ));
        }

        const now = new Date();
        const conversation = await this.conversationRepository.create({
            teamId: input.teamId,
            userId: input.userId,
            title,
            isArchived: false,
            lastMessageAt: normalizedMessage
                ? now
                : (input.lastMessageAt ? new Date(input.lastMessageAt) : null),
            lastProvider: input.lastProvider || null,
            lastModel: input.lastModel || null
        } as any);

        const userMessage = normalizedMessage
            ? await this.messageRepository.create({
                conversationId: conversation._id,
                role: 'user',
                parts: [{ type: 'text', text: normalizedMessage }],
                content: normalizedMessage,
                modelInfo: null,
                tokenUsage: null,
                createdAt: now,
                updatedAt: now
            } as any)
            : null;

        return Result.ok({
            conversation: {
                _id: conversation._id,
                ...conversation.props
            },
            userMessage: userMessage
                ? this.messageDTOMapper.toDTO(userMessage)
                : undefined
        });
    }
}
