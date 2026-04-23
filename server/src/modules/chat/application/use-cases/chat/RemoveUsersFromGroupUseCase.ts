import { ErrorCodes } from '@core/constants/error-codes';
import { RemoveUsersFromGroupInputDTO, RemoveUsersFromGroupOutputDTO } from '@modules/chat/application/dtos/chat/RemoveUsersFromGroupDTO';
import type { ChatParticipant } from '@modules/chat/domain/entities/chat/Chat';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { resolveGroupChat } from '@modules/chat/utilities/chat/resolveGroupChat';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

const toParticipantId = (participant: ChatParticipant): string => {
    if (typeof participant === 'string') {
        return participant;
    }

    if (participant._id) {
        return participant._id.toString();
    }

    return participant.toString();
};

@injectable()
export class RemoveUsersFromGroupUseCase implements IUseCase<RemoveUsersFromGroupInputDTO, RemoveUsersFromGroupOutputDTO, ApplicationError> {
    constructor(
        
        private chatRepo: ChatRepository,
        
        private socketEmitter: SocketIOEmitter
    ){}

    async execute(input: RemoveUsersFromGroupInputDTO): Promise<Result<RemoveUsersFromGroupOutputDTO, ApplicationError>> {
        const { userId, chatId, userIds } = input;

        const chatResult = await resolveGroupChat(this.chatRepo, chatId, userId, true);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }
        const chat = chatResult.value!;

        const newParticipants = chat.props.participants.filter((participant) => !userIds.includes(toParticipantId(participant)));
        if (newParticipants.length < 2) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.CHAT_GROUP_MIN_PARTICIPANTS,
                'The group must have at least 2 members'
            ));
        }

        const newAdmins = chat.props.admins.filter((admin) => !userIds.includes(admin));
        const updatedChat = await this.chatRepo.updateById(chatId, {
            participants: newParticipants,
            admins: newAdmins
        });

        if (!updatedChat) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'users_removed_from_group', {
            chatId,
            userIds,
            removedBy: userId
        });

        return Result.ok(toPersistedEntity(updatedChat));
    }
};
