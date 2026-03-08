import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { ITeamRepository } from '@modules/team/domain/port/ITeamRepository';
import { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';
import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { CreateGroupChatInputDTO, CreateGroupChatOutputDTO } from '@modules/chat/application/dtos/chat/CreateGroupChatDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import { ensureTeamMembersExist } from '@modules/chat/application/helpers/ensureTeamMembersExist';
import { toPersistedChatOutput } from '@modules/chat/application/helpers/toPersistedChatOutput';

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

        return Result.ok(toPersistedChatOutput(chat));
    }
};
