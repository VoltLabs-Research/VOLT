import { ErrorCodes } from '@core/constants/error-codes';
import { GroupAdminAction, UpdateGroupAdminsInputDTO, UpdateGroupAdminsOutputDTO } from '@modules/chat/application/dtos/chat/UpdateGroupAdminsDTO';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { isParticipant } from '@modules/chat/utilities/chat/isParticipant';
import { resolveGroupChat } from '@modules/chat/utilities/chat/resolveGroupChat';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class UpdateGroupAdminsUseCase implements IUseCase<UpdateGroupAdminsInputDTO, UpdateGroupAdminsOutputDTO, ApplicationError> {
    constructor(
        private chatRepo: ChatRepository
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

        return Result.ok(toPersistedEntity(updatedChat));
    }
}
