import { CreateGroupChatInputDTO, CreateGroupChatOutputDTO } from '@modules/chat/application/dtos/chat/CreateGroupChatDTO';
import { ensureTeamMembersExist } from '@modules/chat/utilities/chat/ensureTeamMembersExist';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { ErrorCodes } from '@core/constants/error-codes';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';

@injectable()
export class CreateGroupChatUseCase implements IUseCase<CreateGroupChatInputDTO, CreateGroupChatOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepo: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepo: ITeamMemberRepository,
        @inject(SOCKET_TOKENS.SocketEmitter)
        private socketEmitter: ISocketEmitter
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

        for (const userId of allUserIds) {
            this.socketEmitter.emitToRoom(`user-${userId}`, 'group_created', {
                chatId: chat._id,
                createdBy: userId
            });
        }

        return Result.ok(toPersistedEntity(chat));
    }
};
