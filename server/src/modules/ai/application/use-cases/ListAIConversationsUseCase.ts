import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import {
    ListAIConversationsInputDTO,
    ListAIConversationsOutputDTO,
    AIConversationDTO
} from '@modules/ai/application/dtos/ListAIConversationsDTO';

@injectable()
export default class ListAIConversationsUseCase implements IUseCase<ListAIConversationsInputDTO, ListAIConversationsOutputDTO, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository
    ) {}

    async execute(input: ListAIConversationsInputDTO): Promise<Result<ListAIConversationsOutputDTO, ApplicationError>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(200, Number(input.limit || 50)));
        const includeArchived = input.includeArchived === true || input.includeArchived === 'true';

        const filter: any = {
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
            _id: conversation.id,
            ...conversation.props
        }));

        return Result.ok({
            ...result,
            data
        });
    }
}
