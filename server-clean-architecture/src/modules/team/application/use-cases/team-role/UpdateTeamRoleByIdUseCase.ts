import { ITeamRoleRepository } from "../../../domain/ports/ITeamRoleRepository";
import { Result } from "@/src/shared/domain/ports/Result";
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
        const currentRole = await this.teamRoleRepository.findById(input.roleId);

        if (!currentRole) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            ));
        }

        if (currentRole.props.isSystem && input.name && input.name !== currentRole.props.name) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_ROLE_IS_SYSTEM,
                'Cannot rename system roles'
            ));
        }

        const updateData = currentRole.props.isSystem
            ? { permissions: input.permissions }
            : { name: input.name, permissions: input.permissions };

        const teamRole = await this.teamRoleRepository.updateById(input.roleId, updateData);

        if (!teamRole) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Failed to update team role'
            ));
        }

        return Result.ok(teamRole.props);
    }
}