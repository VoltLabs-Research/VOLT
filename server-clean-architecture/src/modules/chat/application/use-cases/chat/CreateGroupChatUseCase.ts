import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from 'tsyringe';
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { TEAM_TOKENS } from "@/src/modules/team/infrastructure/di/TeamTokens";
import { IChatRepository } from "../../../domain/port/IChatRepository";
import { ITeamRepository } from "@/src/modules/team/domain/ports/ITeamRepository";
import { CreateGroupChatInputDTO, CreateGroupChatOutputDTO } from "../../dtos/chat/CreateGroupChatDTO";
import { ErrorCodes } from "@/src/core/constants/error-codes";

@injectable()
export default class CreateGroupChatUseCase implements IUseCase<CreateGroupChatInputDTO, CreateGroupChatOutputDTO, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatRepository)
        private chatRepo: IChatRepository,
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepo: ITeamRepository
    ){}

    async execute(input: CreateGroupChatInputDTO): Promise<Result<CreateGroupChatOutputDTO, ApplicationError>>{
        const { teamId, participantIds, groupName, ownerId, groupDescription } = input;
        
        const team = await this.teamRepo.findById(teamId);
        if(!team){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        // TODO: this.teamRepo.validateMembers(teamId, participantIds)
        const chat = await this.chatRepo.create({
            participants: [...new Set([ ownerId, ...participantIds ])],
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