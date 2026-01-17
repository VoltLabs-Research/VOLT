import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { IChatRepository } from "../../../domain/port/IChatRepository";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { GroupAdminAction, UpdateGroupAdminsInputDTO, UpdateGroupAdminsOutputDTO } from "../../dtos/chat/UpdateGroupAdminsDTO";

@injectable()
export class UpdateGroupAdminsUseCase implements IUseCase<UpdateGroupAdminsInputDTO, UpdateGroupAdminsOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ) { }

    async execute(input: UpdateGroupAdminsInputDTO): Promise<Result<UpdateGroupAdminsOutputDTO, ApplicationError>> {
        const { action, chatId, requesterId, targetUserIds } = input;
        const chat = await this.chatRepo.findById(chatId);
        if (!chat || !chat.props.isGroup || !chat.props.isActive) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        if (!chat.isAdmin(requesterId)) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_UNAUTHORIZED,
                'Unauthorized'
            ));
        }

        // Validate that are participants
        const validUsers = input.targetUserIds.filter((id) => chat.props.participants.includes(id));
        if (validUsers.length !== targetUserIds.length) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.CHAT_USERS_NOT_IN_TEAM,
                'Users not in team'
            ));
        }

        let updatedAdmins = [...chat.props.admins];
        if (input.action === GroupAdminAction.Add) {
            updatedAdmins = [...new Set([...updatedAdmins, ...validUsers])];
        } else if (input.action === GroupAdminAction.Remove) {
            updatedAdmins = updatedAdmins.filter((admin) => !validUsers.includes(admin));
            if (updatedAdmins.length === 0) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.CHAT_GROUP_MIN_ADMINS,
                    'At least 1 ad mins is required'
                ));
            }
        } else {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.CHAT_INVALID_ACTION,
                'Chat invalid action'
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

        return Result.ok(updatedChat.props);
    }
};