import { ErrorCodes } from '@core/constants/error-codes';
import { AddUsersToGroupInputDTO, AddUsersToGroupOutputDTO } from '@modules/chat/application/dtos/chat/AddUsersToGroupDTO';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { ensureTeamMembersExist } from '@modules/chat/utilities/chat/ensureTeamMembersExist';
import { resolveGroupChat } from '@modules/chat/utilities/chat/resolveGroupChat';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class AddUsersToGroupUseCase implements IUseCase<AddUsersToGroupInputDTO, AddUsersToGroupOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepo: ITeamMemberRepository,
        @inject(SOCKET_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter
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
