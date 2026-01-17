import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import { inject, injectable } from 'tsyringe';
import { TEAM_TOKENS } from "@/src/modules/team/infrastructure/di/TeamTokens";
import { ITeamRepository } from "@/src/modules/team/domain/ports/ITeamRepository";
import { GetTeamMembersInputDTO, GetTeamMembersOutputDTO } from "../../dtos/chat/GetTeamMembersDTO";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";

@injectable()
export default class GetTeamMembersUseCase implements IUseCase<GetTeamMembersInputDTO, GetTeamMembersOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepo: ITeamRepository,
    ){}

    async execute(input: GetTeamMembersInputDTO): Promise<Result<GetTeamMembersOutputDTO, ApplicationError>>{
        const hasAccess = await this.teamRepo.hasAccess(input.userId, input.teamId);

        if(!hasAccess){
            return Result.fail(
                new ApplicationError('TEAM_NOT_FOUND', 'Team not found or access denied', 404)
            );
        }

        const members = await this.teamRepo.getTeamMembersWithUserData(input.teamId);

        // Filter out the current user from the members list
        const filteredMembers = members.filter(member => member._id.toString() !== input.userId);

        return Result.ok({
            members: filteredMembers as any
        });
    }
};
