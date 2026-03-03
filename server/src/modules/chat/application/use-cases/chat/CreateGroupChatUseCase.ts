import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import { CreateGroupChatInputDTO, CreateGroupChatOutputDTO } from '@modules/chat/application/dtos/chat/CreateGroupChatDTO';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class CreateGroupChatUseCase implements IUseCase<CreateGroupChatInputDTO, CreateGroupChatOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepo: ITeamRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepo: ITeamMemberRepository
    ){}

    async execute(input: CreateGroupChatInputDTO): Promise<Result<CreateGroupChatOutputDTO, ApplicationError>> {
        const { teamId, participantIds, groupName, ownerId, groupDescription } = input;

        const team = await this.teamRepo.findById(teamId);
        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const allUserIds = [...new Set([ownerId, ...participantIds])];
        const memberChecks = await Promise.all(
            allUserIds.map((userId) => this.teamMemberRepo.findOne({ team: teamId, user: userId }))
        );
        const invalidIndex = memberChecks.findIndex((member) => !member);
        if(invalidIndex !== -1){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                `User ${allUserIds[invalidIndex]} is not a member of this team`
            ));
        }

        const chat = await this.chatRepo.create({
            participants: allUserIds,
            team: teamId,
            isGroup: true,
            groupName,
            groupDescription,
            admins: [ownerId],
            createdBy: ownerId,
            isActive: true
        });

        return Result.ok(chat.props);
    }
};