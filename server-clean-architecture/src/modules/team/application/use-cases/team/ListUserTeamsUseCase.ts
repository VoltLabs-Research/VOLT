import { ITeamRepository } from "../../../domain/ports/ITeamRepository";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ListUserTeamsInputDTO, ListUserTeamsOutputDTO } from "../../dtos/team/ListUserTeamsDTO";

@injectable()
export default class ListUserTeamsUseCase implements IUseCase<ListUserTeamsInputDTO, ListUserTeamsOutputDTO[], ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private teamRepository: ITeamRepository
    ){}
    
    async execute(input: ListUserTeamsInputDTO): Promise<Result<ListUserTeamsOutputDTO[], ApplicationError>>{
        const { userId } = input;
        const userTeams = await this.teamRepository.findUserTeams(userId);
        return Result.ok(userTeams);
    }
};