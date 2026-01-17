import { ITeamRoleRepository } from "../../../domain/ports/ITeamRoleRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from "tsyringe";
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ListTeamRolesByTeamIdInputDTO, ListTeamRolesByTeamIdOutputDTO } from "../../dtos/team-role/ListTeamRolesByTeamIdDTO";

@injectable()
export default class ListTeamRolesByTeamIdUseCase implements IUseCase<ListTeamRolesByTeamIdInputDTO, ListTeamRolesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ) { }

    async execute(input: ListTeamRolesByTeamIdInputDTO): Promise<Result<ListTeamRolesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page, limit } = input;
        console.log('List Team Roles by Team Id Use Caes', teamId)
        const results = await this.teamRoleRepository.findAll({ filter: { team: teamId }, page, limit });
        return Result.ok({
            ...results,
            data: results.data.map(r => r.props)
        });
    }
}