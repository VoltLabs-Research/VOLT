import type TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteTeamRoleByIdInputDTO, DeleteTeamRoleByIdOutputDTO } from '@modules/team/application/dtos/team-role/DeleteTeamRoleByIdDTO';
import TeamRoleDeletedEvent from '@modules/team/domain/events/team-role/TeamRoleDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamRoleByIdUseCase implements IUseCase<DeleteTeamRoleByIdInputDTO, DeleteTeamRoleByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: TeamRoleRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: DeleteTeamRoleByIdInputDTO): Promise<Result<DeleteTeamRoleByIdOutputDTO, ApplicationError>> {
        const { roleId, teamId } = input;

        if (!input.userId) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                'Authentication required'
            ));
        }

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
            { role: memberRole._id }
        );

        const result = await this.teamRoleRepository.deleteById(roleId);
        if (!result) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Failed to delete team role'
            ));
        }

        await this.eventBus.publish(new TeamRoleDeletedEvent({
            teamRoleId: roleId,
            teamId,
            userId: input.userId,
            roleName: roleToDelete.props.name ?? ''
        }));

        return Result.ok({ success: true });
    }
}
