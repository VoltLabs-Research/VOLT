import { ErrorCodes } from '@core/constants/error-codes';
import { CreateGroupChatInputDTO, CreateGroupChatOutputDTO } from '@modules/chat/application/dtos/chat/CreateGroupChatDTO';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { ensureTeamMembersExist } from '@modules/chat/utilities/chat/ensureTeamMembersExist';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class CreateGroupChatUseCase implements IUseCase<CreateGroupChatInputDTO, CreateGroupChatOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository,
        @inject(TEAM_TOKENS.TeamRepository) private readonly teamRepo: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepo: ITeamMemberRepository,
        @inject(SOCKET_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter
    ){}

    async execute(input: CreateGroupChatInputDTO): Promise<Result<CreateGroupChatOutputDTO, ApplicationError>> {
        const { teamId, participantIds, groupName, userId, groupDescription } = input;

        const team = await this.teamRepo.findById(teamId);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const allUserIds = [...new Set([userId, ...participantIds])];
        const membersResult = await ensureTeamMembersExist(this.teamMemberRepo, teamId, allUserIds);
        if (!membersResult.success) {
            return Result.fail(membersResult.error!);
        }

        const chat = await this.chatRepo.create({
            participants: allUserIds,
            team: teamId,
            isGroup: true,
            groupName,
            groupDescription,
            admins: [userId],
            createdBy: userId,
            isActive: true
        });

        for (const participantId of allUserIds) {
            this.socketEmitter.emitToRoom(`user-${participantId}`, 'group_created', {
                chatId: chat._id,
                createdBy: userId
            });
        }

        return Result.ok(toPersistedEntity(chat));
    }
}
