import { ITeamRoleRepository } from "../../../domain/ports/ITeamRoleRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO } from "../../dtos/team-role/CreateTeamRoleDTO";
import { injectable, inject } from "tsyringe";
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ErrorCodes } from "@/src/core/constants/error-codes";

@injectable()
export default class CreateTeamRoleUseCase implements IUseCase<CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,
    ){}

    async execute(input: CreateTeamRoleInputDTO): Promise<Result<CreateTeamRoleOutputDTO, ApplicationError>>{
        const { teamId, name, permissions, isSystem } = input;

        if (!teamId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_ID_REQUIRED,
                'Team ID is required'
            ));
        }

        if (!name) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_ROLE_NAME_REQUIRED,
                'Role name is required'
            ));
        }

        const newRole = await this.teamRoleRepository.create({
            team: teamId,
            name,
            permissions: permissions || [],
            isSystem,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok(newRole.props);
    }
};