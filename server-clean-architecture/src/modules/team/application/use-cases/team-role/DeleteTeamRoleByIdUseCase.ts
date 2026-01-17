import { ITeamRoleRepository } from "../../../domain/ports/ITeamRoleRepository";
import { ITeamMemberRepository } from "../../../domain/ports/ITeamMemberRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from "tsyringe";
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { DeleteTeamRoleByIdInputDTO, DeleteTeamRoleByIdOutputDTO } from "../../dtos/team-role/DeleteTeamRoleByIdDTO";
import { ErrorCodes } from "@/src/core/constants/error-codes";

@injectable()
export default class DeleteTeamRoleByIdUseCase implements IUseCase<DeleteTeamRoleByIdInputDTO, DeleteTeamRoleByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ){}

    async execute(input: DeleteTeamRoleByIdInputDTO): Promise<Result<DeleteTeamRoleByIdOutputDTO, ApplicationError>>{
        const { roleId, teamId } = input;

        const roleToDelete = await this.teamRoleRepository.findById(roleId);
        if (!roleToDelete) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            ));
        }

        if (roleToDelete.props.isSystem) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_ROLE_IS_SYSTEM,
                'Cannot delete system roles'
            ));
        }

        const memberRole = await this.teamRoleRepository.findOne({
            team: teamId,
            name: 'Member',
            isSystem: true
        });

        if (!memberRole) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Member role not found'
            ));
        }

        await this.teamMemberRepository.updateMany(
            { team: teamId, role: roleId },
            { role: memberRole.id }
        );

        const result = await this.teamRoleRepository.deleteById(roleId);
        if (!result) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Failed to delete team role'
            ));
        }

        return Result.ok({ success: true });
    }
};