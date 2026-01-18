import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import { CreateGroupChatInputDTO, CreateGroupChatOutputDTO } from '@modules/chat/application/dtos/chat/CreateGroupChatDTO';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class CreateGroupChatUseCase implements IUseCase<CreateGroupChatInputDTO, CreateGroupChatOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepo: ITeamRepository
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

        // TODO: this.teamRepo.validateMembers(teamId, participantIds)
        const chat = await this.chatRepo.create({
            participants: [...new Set([ownerId, ...participantIds])],
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