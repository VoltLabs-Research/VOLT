import { GroupAdminAction, UpdateGroupAdminsInputDTO, UpdateGroupAdminsOutputDTO } from '@modules/chat/application/dtos/chat/UpdateGroupAdminsDTO';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { isParticipant } from '@modules/chat/utilities/chat/isParticipant';
import { resolveGroupChat } from '@modules/chat/utilities/chat/resolveGroupChat';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { ErrorCodes } from '@core/constants/error-codes';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';

@injectable()
export class UpdateGroupAdminsUseCase implements IUseCase<UpdateGroupAdminsInputDTO, UpdateGroupAdminsOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(SOCKET_TOKENS.SocketEmitter)
        private socketEmitter: ISocketEmitter
    ){}

    async execute(input: UpdateGroupAdminsInputDTO): Promise<Result<UpdateGroupAdminsOutputDTO, ApplicationError>> {
        const { action, chatId, userId, targetUserIds } = input;

        const chatResult = await resolveGroupChat(this.chatRepo, chatId, userId, true);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }
        const chat = chatResult.value!;

        const validUsers = targetUserIds.filter((id) => isParticipant(chat, id));
        if (validUsers.length !== targetUserIds.length) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.CHAT_USERS_NOT_IN_TEAM,
                'Users not in team'
            ));
        }

        let updatedAdmins = [...chat.props.admins];
        if (action === GroupAdminAction.Add) {
            updatedAdmins = [...new Set([...updatedAdmins, ...validUsers])];
        } else if (action === GroupAdminAction.Remove) {
            updatedAdmins = updatedAdmins.filter((admin) => !validUsers.includes(admin));
            if (updatedAdmins.length === 0) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.CHAT_GROUP_MIN_ADMINS,
                    'At least 1 admin is required'
                ));
            }
        } else {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.CHAT_INVALID_ACTION,
                'Invalid group admin action'
            ));
        }

        const updatedChat = await this.chatRepo.updateById(chatId, {
            admins: updatedAdmins
        });

        if (!updatedChat) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'group_admins_updated', {
            chatId,
            action,
            targetUserIds: validUsers,
            updatedBy: userId
        });

        return Result.ok(toPersistedEntity(updatedChat));
    }
};
