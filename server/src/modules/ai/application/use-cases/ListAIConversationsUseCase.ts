import { AIConversationDTO, ListAIConversationsInputDTO } from '@modules/ai/application/dtos/ListAIConversationsDTO';
import type { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';
import AIConversationRepository from '@modules/ai/infrastructure/persistence/mongo/repositories/AIConversationRepository';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface ListAIConversationsFilter extends Partial<AIConversationProps> {
    teamId: string;
    userId: string;
};

@Singleton()
export default class ListAIConversationsUseCase implements IUseCase<ListAIConversationsInputDTO, PaginatedResult<AIConversationDTO>, ApplicationError> {
    constructor(
        
        private readonly conversationRepository: AIConversationRepository
    ) {}

    async execute(input: ListAIConversationsInputDTO): Promise<Result<PaginatedResult<AIConversationDTO>, ApplicationError>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(200, input.limit ?? 50));
        const includeArchived = input.includeArchived === true;

        const filter: ListAIConversationsFilter = {
            teamId: input.teamId,
            userId: input.userId
        };

        if (!includeArchived) {
            filter.isArchived = false;
        }

        const result = await this.conversationRepository.findAll({
            filter,
            page,
            limit,
            sort: {
                lastMessageAt: -1,
                updatedAt: -1
            }
        });

        const data: AIConversationDTO[] = result.data.map((conversation) => ({
            _id: conversation._id,
            ...conversation.props
        }));

        return Result.ok({
            ...result,
            data
        });
    }
};
