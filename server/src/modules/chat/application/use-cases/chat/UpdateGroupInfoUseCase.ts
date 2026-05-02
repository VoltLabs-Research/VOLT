import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateGroupInfoInputDTO, UpdateGroupInfoOutputDTO } from '@modules/chat/application/dtos/chat/UpdateGroupInfoDTO';
import type { ChatProps } from '@modules/chat/domain/entities/chat/Chat';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { resolveGroupChat } from '@modules/chat/utilities/chat/resolveGroupChat';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class UpdateGroupInfoUseCase implements IUseCase<UpdateGroupInfoInputDTO, UpdateGroupInfoOutputDTO, ApplicationError> {
    constructor(
        private chatRepo: ChatRepository,
        private socketEmitter: SocketIOEmitter
    ){}

    async execute(input: UpdateGroupInfoInputDTO): Promise<Result<UpdateGroupInfoOutputDTO, ApplicationError>> {
        const { userId, chatId, groupName, groupDescription } = input;

        const chatResult = await resolveGroupChat(this.chatRepo, chatId, userId, true);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }

        const updateData: Partial<ChatProps> = {};
        if (groupName) updateData.groupName = groupName;
        if (groupDescription) updateData.groupDescription = groupDescription;

        const updatedChat = await this.chatRepo.updateById(chatId, updateData);
        if (!updatedChat) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Chat not found after update'
            ));
        }

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'group_info_updated', {
            chatId,
            groupName,
            groupDescription,
            updatedBy: userId
        });

        return Result.ok(toPersistedEntity(updatedChat));
    }
}
