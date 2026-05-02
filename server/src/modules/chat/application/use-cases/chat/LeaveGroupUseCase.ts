import { ErrorCodes } from '@core/constants/error-codes';
import { LeaveGroupInputDTO } from '@modules/chat/application/dtos/chat/LeaveGroupDTO';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { resolveGroupChat } from '@modules/chat/utilities/chat/resolveGroupChat';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class LeaveGroupUseCase implements IUseCase<LeaveGroupInputDTO, null, ApplicationError> {
    constructor(
        private chatRepo: ChatRepository,
        private socketEmitter: SocketIOEmitter
    ){}

    async execute(input: LeaveGroupInputDTO): Promise<Result<null, ApplicationError>> {
        const { chatId, userId } = input;

        const chatResult = await resolveGroupChat(this.chatRepo, chatId, userId);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }
        const chat = chatResult.value!;

        const newParticipants = chat.props.participants.filter((participant) => participant !== userId);
        let newAdmins = chat.props.admins.filter((admin) => admin !== userId);

        if (newAdmins.length === 0 && chat.props.createdBy) {
            newAdmins = [chat.props.createdBy];
        }

        const isActive = newParticipants.length >= 2;

        const updatedChat = await this.chatRepo.updateById(chatId, {
            participants: newParticipants,
            admins: newAdmins,
            isActive
        });

        if (!updatedChat) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'user_left_group', {
            chatId,
            userId
        });

        return Result.ok(null);
    }
}
