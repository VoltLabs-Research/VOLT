import { ErrorCodes } from '@core/constants/error-codes';
import { AddUsersToGroupInputDTO, AddUsersToGroupOutputDTO } from '@modules/chat/application/dtos/chat/AddUsersToGroupDTO';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { ensureTeamMembersExist } from '@modules/chat/utilities/chat/ensureTeamMembersExist';
import { resolveGroupChat } from '@modules/chat/utilities/chat/resolveGroupChat';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class AddUsersToGroupUseCase implements IUseCase<AddUsersToGroupInputDTO, AddUsersToGroupOutputDTO, ApplicationError> {
    constructor(
        private chatRepo: ChatRepository,
        private teamMemberRepo: TeamMemberRepository,
        private socketEmitter: SocketIOEmitter
    ){}

    async execute(input: AddUsersToGroupInputDTO): Promise<Result<AddUsersToGroupOutputDTO, ApplicationError>> {
        const { userId, chatId, userIds } = input;

        const chatResult = await resolveGroupChat(this.chatRepo, chatId, userId, true);
        if (!chatResult.success) {
            return Result.fail(chatResult.error!);
        }
        const chat = chatResult.value!;

        const teamId = chat.props.team;
        const membersResult = await ensureTeamMembersExist(this.teamMemberRepo, teamId, userIds);
        if (!membersResult.success) {
            return Result.fail(membersResult.error!);
        }

        const newParticipants = new Set([...chat.props.participants, ...userIds]);

        const updatedChat = await this.chatRepo.updateById(chat._id, { participants: Array.from(newParticipants) });
        if (!updatedChat) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Chat not found after update'
            ));
        }

        this.socketEmitter.emitToRoom(`chat-${chatId}`, 'users_added_to_group', {
            chatId,
            userIds,
            addedBy: userId
        });

        return Result.ok(toPersistedEntity(updatedChat));
    }
}
