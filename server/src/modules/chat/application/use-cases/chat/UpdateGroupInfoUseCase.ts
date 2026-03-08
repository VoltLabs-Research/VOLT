import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { UpdateGroupInfoInputDTO, UpdateGroupInfoOutputDTO } from '@modules/chat/application/dtos/chat/UpdateGroupInfoDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import { ChatProps } from '@modules/chat/domain/entities/Chat';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { resolveGroupChat } from '@modules/chat/application/helpers/resolveGroupChat';
import { toPersistedChatOutput } from '@modules/chat/application/helpers/toPersistedChatOutput';

@injectable()
export class UpdateGroupInfoUseCase implements IUseCase<UpdateGroupInfoInputDTO, UpdateGroupInfoOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(SOCKET_TOKENS.SocketEmitter)
        private socketEmitter: ISocketEmitter
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

        return Result.ok(toPersistedChatOutput(updatedChat));
    }
};
