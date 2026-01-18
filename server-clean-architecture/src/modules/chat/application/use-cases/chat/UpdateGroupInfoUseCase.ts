import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { UpdateGroupInfoInputDTO, UpdateGroupInfoOutputDTO } from '@modules/chat/application/dtos/chat/UpdateGroupInfoDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import { ChatProps } from '@modules/chat/domain/entities/Chat';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export class UpdateGroupInfoUseCase implements IUseCase<UpdateGroupInfoInputDTO, UpdateGroupInfoOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository
    ) { }

    async execute(input: UpdateGroupInfoInputDTO): Promise<Result<UpdateGroupInfoOutputDTO, ApplicationError>> {
        const { userId, chatId, groupName, groupDescription } = input;
        const chat = await this.chatRepo.findById(input.chatId);

        if (!chat) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        if (!chat.isAdmin(userId)) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_UNAUTHORIZED,
                'Only admins can update info'
            ));
        }

        const updateData: Partial<ChatProps> = {};
        if (groupName) updateData.groupName = groupName;
        if (groupDescription) updateData.groupDescription = groupDescription;

        const updatedChat = await this.chatRepo.updateById(input.chatId, updateData);
        if (!updatedChat) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Chat not found after update'
            ));
        }

        return Result.ok(updatedChat.props);
    }
};