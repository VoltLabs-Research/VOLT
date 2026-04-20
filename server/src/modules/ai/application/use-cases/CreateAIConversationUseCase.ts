import type { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';
import type { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';
import { AIMessageRole } from '@modules/ai/domain/entities/AIMessage';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import AIMessageDTOMapper from '@modules/ai/utilities/AIMessageDTOMapper';
import { CreateAIConversationInputDTO, CreateAIConversationOutputDTO } from '@modules/ai/application/dtos/CreateAIConversationDTO';
import { inject, injectable } from 'tsyringe';

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
        const conversationData: Partial<AIConversationProps> = {
            teamId: input.teamId,
            userId: input.userId,
            title,
            isArchived: false,
            lastMessageAt: normalizedMessage
                ? now
                : null
        };
        const conversation = await this.conversationRepository.create(conversationData);

        const userMessage = normalizedMessage
            ? await this.messageRepository.create({
                conversationId: conversation._id,
                role: AIMessageRole.User,
                parts: [
                    {
                        type: 'text',
                        text: normalizedMessage
                    }
                ],
                content: normalizedMessage,
                modelInfo: null,
                tokenUsage: null,
                createdAt: now,
                updatedAt: now
            } satisfies Partial<AIMessageProps>)
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
};
