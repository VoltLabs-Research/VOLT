import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { AI_TOKENS } from '@modules/ai/application/di/AITokens';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import {
    ListAIConversationMessagesInputDTO,
    ListAIConversationMessagesOutputDTO,
    AIMessageDTO
} from '@modules/ai/application/dtos/ListAIConversationMessagesDTO';
import AIMessageDTOMapper from '@modules/ai/application/services/AIMessageDTOMapper';

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
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(200, Number(input.limit || 50)));

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
}
