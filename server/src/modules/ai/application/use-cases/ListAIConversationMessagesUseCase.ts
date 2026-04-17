import { ErrorCodes } from '@core/constants/error-codes';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import { AIMessageDTO, ListAIConversationMessagesInputDTO, ListAIConversationMessagesOutputDTO } from '@modules/ai/application/dtos/ListAIConversationMessagesDTO';
import AIMessageDTOMapper from '@modules/ai/utilities/AIMessageDTOMapper';
import { inject, injectable } from 'tsyringe';

interface ListAIConversationMessagesLookup {
    _id: string;
    teamId: string;
    userId: string;
};

@injectable()
export default class ListAIConversationMessagesUseCase implements IUseCase<ListAIConversationMessagesInputDTO, ListAIConversationMessagesOutputDTO, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository,

        @inject(AI_TOKENS.AIMessageRepository)
        private readonly messageRepository: IAIMessageRepository,

        @inject(AI_TOKENS.AIMessageDTOMapper)
        private readonly messageDTOMapper: AIMessageDTOMapper
    ) {}

    async execute(input: ListAIConversationMessagesInputDTO): Promise<Result<ListAIConversationMessagesOutputDTO, ApplicationError>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(200, input.limit ?? 50));

        const conversation = await this.conversationRepository.findOne({
            _id: input.conversationId,
            teamId: input.teamId,
            userId: input.userId
        } as ListAIConversationMessagesLookup);

        if (!conversation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            ));
        }

        const result = await this.messageRepository.findAll({
            filter: {
                conversationId: conversation._id
            },
            page,
            limit,
            sort: {
                createdAt: 1
            }
        });

        const data: AIMessageDTO[] = result.data.map((msg) => this.messageDTOMapper.toDTO(msg));

        return Result.ok({
            ...result,
            data
        });
    }
};
