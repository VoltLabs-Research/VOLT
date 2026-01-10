import { ITeamRoleRepository } from "../../../domain/ports/ITeamRoleRepository";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from "tsyringe";
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { UpdateTeamRoleByIdInputDTO, UpdateTeamRoleByIdOutputDTO } from "../../dtos/team-role/UpdateTeamRoleByIdDTO";

@injectable()
export default class UpdateTeamRoleByIdUseCase implements IUseCase<UpdateTeamRoleByIdInputDTO, UpdateTeamRoleByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ){}

    async execute(input: UpdateTeamRoleByIdInputDTO): Promise<Result<UpdateTeamRoleByIdOutputDTO, ApplicationError>>{
        const teamRole = await this.teamRoleRepository.updateById(input.roleId, {
            name: input.name,
            permissions: input.permissions
        });

        if(!teamRole){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            ));
        }

        return Result.ok(teamRole.props);
    }
}