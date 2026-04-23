import { ErrorCodes } from '@core/constants/error-codes';
import { CreateGroupChatInputDTO, CreateGroupChatOutputDTO } from '@modules/chat/application/dtos/chat/CreateGroupChatDTO';
import ChatRepository from '@modules/chat/infrastructure/persistence/mongo/repositories/chat/ChatRepository';
import { ensureTeamMembersExist } from '@modules/chat/utilities/chat/ensureTeamMembersExist';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class CreateGroupChatUseCase implements IUseCase<CreateGroupChatInputDTO, CreateGroupChatOutputDTO, ApplicationError> {
    constructor(
        
        private chatRepo: ChatRepository,
        
        private teamRepo: TeamRepository,
        
        private teamMemberRepo: TeamMemberRepository,
        
        private socketEmitter: SocketIOEmitter
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
