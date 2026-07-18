import { ErrorCodes } from '@core/constants/error-codes';
import { CreateGroupChatInputDTO, CreateGroupChatOutputDTO } from '@modules/chat/application/dtos/chat/CreateGroupChatDTO';
import type { IChatRepository } from '@modules/chat/domain/port/chat/IChatRepository';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { ensureTeamMembersExist } from '@modules/chat/utilities/chat/ensureTeamMembersExist';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { SOCKET_CONTRACT_TOKENS } from '@shared/contracts/tokens/SocketTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { inject, injectable } from 'tsyringe';

@injectable()
export class CreateGroupChatUseCase implements IUseCase<CreateGroupChatInputDTO, CreateGroupChatOutputDTO> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository) private readonly chatRepo: IChatRepository,
        @inject(TEAM_CONTRACT_TOKENS.TeamRepository) private readonly teamRepo: ITeamRepository,
        @inject(TEAM_CONTRACT_TOKENS.TeamMemberRepository) private readonly teamMemberRepo: ITeamMemberRepository,
        @inject(SOCKET_CONTRACT_TOKENS.SocketEmitter) private readonly socketEmitter: ISocketEmitter
    ){}

    async execute(input: CreateGroupChatInputDTO): Promise<CreateGroupChatOutputDTO> {
        const { teamId, participantIds, groupName, userId, groupDescription } = input;

        const team = await this.teamRepo.findById(teamId);
        if (!team) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            );
        }

        const allUserIds = [...new Set([userId, ...participantIds])];
        await ensureTeamMembersExist(this.teamMemberRepo, teamId, allUserIds);

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

        return toPersistedEntity(chat);
    }
}
