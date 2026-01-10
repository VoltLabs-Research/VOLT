import { ITeamRoleRepository } from "../../../domain/ports/ITeamRoleRepository";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO } from "../../dtos/team-role/CreateTeamRoleDTO";
import { injectable, inject } from "tsyringe";
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";

@injectable()
export default class CreateTeamRoleUseCase implements IUseCase<CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ){}

    async execute(input: CreateTeamRoleInputDTO): Promise<Result<CreateTeamRoleOutputDTO, ApplicationError>>{
        const { teamId, name, permissions } = input;
        const newRole = await this.teamRoleRepository.create({
            team: teamId,
            name,
            permissions,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok(newRole.props);
    }
};