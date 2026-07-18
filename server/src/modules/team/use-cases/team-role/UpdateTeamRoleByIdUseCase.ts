import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateTeamRoleByIdInputDTO, UpdateTeamRoleByIdOutputDTO } from '@modules/team/dtos/team-role/UpdateTeamRoleByIdDTO';
import TeamRoleUpdatedEvent from '@modules/team/events/team-role/TeamRoleUpdatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class UpdateTeamRoleByIdUseCase implements IUseCase<UpdateTeamRoleByIdInputDTO, UpdateTeamRoleByIdOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: UpdateTeamRoleByIdInputDTO): Promise<UpdateTeamRoleByIdOutputDTO> {
        const currentRole = await this.teamRoleRepository.findById(input.roleId);

        if (!currentRole) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            );
        }

        if (!currentRole.canRenameTo(input.name)) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_ROLE_IS_SYSTEM,
                'Cannot rename system roles'
            );
        }

        const updateData = currentRole.getUpdatePayload({
            name: input.name,
            permissions: input.permissions
        });

        const teamRole = await this.teamRoleRepository.updateById(input.roleId, updateData);

        if (!teamRole) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Failed to update team role'
            );
        }

        await this.eventBus.publish(new TeamRoleUpdatedEvent({
            teamRoleId: teamRole._id,
            teamId: String(teamRole.props.team),
            name: teamRole.props.name,
            permissions: teamRole.props.permissions
        }));

        return toPersistedOutput(teamRole);
    }
}
