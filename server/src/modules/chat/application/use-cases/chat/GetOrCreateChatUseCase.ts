import { ErrorCodes } from '@core/constants/error-codes';
import { GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO } from '@modules/chat/application/dtos/chat/GetOrCreateChatDTO';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class GetOrCreateChatUseCase implements IUseCase<GetOrCreateChatInputDTO, GetOrCreateChatOutputDTO, ApplicationError> {
    constructor(
        
        private chatRepo: ChatRepository
    ){}

    async execute(input: GetOrCreateChatInputDTO): Promise<Result<GetOrCreateChatOutputDTO, ApplicationError>> {
        const { userId, targetUserId, teamId } = input;

        if (userId === targetUserId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.CHAT_INVALID_ACTION,
                'Cannot create chat with yourself'
            ));
        }

        const result = await this.chatRepo.findOrCreateChat(userId, targetUserId, teamId);
        return Result.ok(toPersistedEntity(result));
    }
};
