import { ITeamRoleRepository } from "../../../domain/ports/ITeamRoleRepository";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from "tsyringe";
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ListTeamRolesByTeamIdInputDTO, ListTeamRolesByTeamIdOutputDTO } from "../../dtos/team-role/ListTeamRolesByTeamIdDTO";

@injectable()
export default class ListTeamRolesByTeamIdUseCase implements IUseCase<ListTeamRolesByTeamIdInputDTO, ListTeamRolesByTeamIdOutputDTO[], ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ){}

    async execute(input: ListTeamRolesByTeamIdInputDTO): Promise<Result<ListTeamRolesByTeamIdOutputDTO[], ApplicationError>>{
        const { teamId, page, limit } = input;
        const results = await this.teamRoleRepository.findAll({ filter: { team: teamId }, page, limit });
        return Result.ok(results.map((result) => result.props));
    }
}