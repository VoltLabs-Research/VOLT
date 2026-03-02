import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { IAIConversationRepository } from '@modules/ai/domain/ports/IAIConversationRepository';
import { IAIMessageRepository } from '@modules/ai/domain/ports/IAIMessageRepository';
import { DeleteAIConversationInputDTO } from '@modules/ai/application/dtos/DeleteAIConversationDTO';

@injectable()
export default class DeleteAIConversationUseCase implements IUseCase<DeleteAIConversationInputDTO, null, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository,

        @inject(AI_TOKENS.AIMessageRepository)
        private readonly messageRepository: IAIMessageRepository
    ) {}

    async execute(input: DeleteAIConversationInputDTO): Promise<Result<null, ApplicationError>> {
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

        await this.messageRepository.deleteMany({
            conversationId: conversation.id
        } as any);

        await this.conversationRepository.deleteById(conversation.id);

        return Result.ok(null);
    }
}
