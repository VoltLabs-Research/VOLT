import type { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteTeamRoleByIdInputDTO, DeleteTeamRoleByIdOutputDTO } from '@modules/team/application/dtos/team-role/DeleteTeamRoleByIdDTO';
import TeamRoleDeletedEvent from '@modules/team/domain/events/team-role/TeamRoleDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteTeamRoleByIdUseCase implements IUseCase<DeleteTeamRoleByIdInputDTO, DeleteTeamRoleByIdOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: DeleteTeamRoleByIdInputDTO): Promise<DeleteTeamRoleByIdOutputDTO> {
        const { roleId, teamId } = input;

        if (!input.userId) {
            throw ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                'Authentication required'
            );
        }

        const roleToDelete = await this.teamRoleRepository.findById(roleId);
        if (!roleToDelete) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            );
        }

        if (roleToDelete.props.isSystem) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_ROLE_IS_SYSTEM,
                'Cannot delete system roles'
            );
        }

        const memberRole = await this.teamRoleRepository.findOne({
            team: teamId,
            name: 'Member',
            isSystem: true
        });

        if (!memberRole) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Member role not found'
            );
        }

        await this.teamMemberRepository.updateMany(
            { team: teamId, role: roleId },
            { role: memberRole._id }
        );

        const result = await this.teamRoleRepository.deleteById(roleId);
        if (!result) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Failed to delete team role'
            );
        }

        await this.eventBus.publish(new TeamRoleDeletedEvent({
            teamRoleId: roleId,
            teamId,
            userId: input.userId,
            roleName: roleToDelete.props.name ?? ''
        }));

        return { success: true };
    }
}
