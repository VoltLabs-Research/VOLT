import type { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { AIConversationDTO, ListAIConversationsInputDTO, ListAIConversationsOutputDTO } from '@modules/ai/application/dtos/ListAIConversationsDTO';
import { inject, injectable } from 'tsyringe';

interface ListAIConversationsFilter extends Partial<AIConversationProps> {
    teamId: string;
    userId: string;
};

@injectable()
export default class ListAIConversationsUseCase implements IUseCase<ListAIConversationsInputDTO, ListAIConversationsOutputDTO, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository
    ) {}

    async execute(input: ListAIConversationsInputDTO): Promise<Result<ListAIConversationsOutputDTO, ApplicationError>> {
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
