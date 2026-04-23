import { ErrorCodes } from '@core/constants/error-codes';
import { AIMessageDTO, ListAIConversationMessagesInputDTO } from '@modules/ai/application/dtos/ListAIConversationMessagesDTO';
import AIConversationRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIConversationRepository';
import AIMessageRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIMessageRepository';
import AIMessageDTOMapper from '@modules/ai/utilities/AIMessageDTOMapper';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface ListAIConversationMessagesLookup {
    _id: string;
    teamId: string;
    userId: string;
};

@Singleton()
export default class ListAIConversationMessagesUseCase implements IUseCase<ListAIConversationMessagesInputDTO, PaginatedResult<AIMessageDTO>, ApplicationError> {
    constructor(
        
        private readonly conversationRepository: AIConversationRepository,

        
        private readonly messageRepository: AIMessageRepository,

        
        private readonly messageDTOMapper: AIMessageDTOMapper
    ) {}

    async execute(input: ListAIConversationMessagesInputDTO): Promise<Result<PaginatedResult<AIMessageDTO>, ApplicationError>> {
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
