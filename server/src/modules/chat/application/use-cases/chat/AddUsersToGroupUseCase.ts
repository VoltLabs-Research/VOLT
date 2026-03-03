import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { AddUsersToGroupInputDTO, AddUsersToGroupOutputDTO } from '@modules/chat/application/dtos/chat/AddUsersToGroupDTO';

@injectable()
export class AddUsersToGroupUseCase implements IUseCase<AddUsersToGroupInputDTO, AddUsersToGroupOutputDTO, ApplicationError> {
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepo: ITeamMemberRepository
    ){}

    async execute(input: AddUsersToGroupInputDTO): Promise<Result<AddUsersToGroupOutputDTO, ApplicationError>> {
        const { requesterId, chatId, userIdsToAdd } = input;
        const chat = await this.chatRepo.findById(chatId);

        if (!chat) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.CHAT_NOT_FOUND,
                'Chat not found'
            ));
        }

        if (!chat.isAdmin(requesterId)) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_UNAUTHORIZED,
                'Unauthorized'
            ));
        }

        const teamId = chat.props.team;
        const memberChecks = await Promise.all(
            userIdsToAdd.map((userId) => this.teamMemberRepo.findOne({ team: teamId, user: userId }))
        );
        const invalidIndex = memberChecks.findIndex((member) => !member);
        if(invalidIndex !== -1){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                `User ${userIdsToAdd[invalidIndex]} is not a member of this team`
            ));
        }

        const newParticipants = new Set([...chat.props.participants, ...userIdsToAdd]);

        const updatedChat = await this.chatRepo.updateById(chat.id, { participants: Array.from(newParticipants) });
        if (!updatedChat) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Chat not found after update'
            ));
        }

        return Result.ok(updatedChat.props);
    }
};