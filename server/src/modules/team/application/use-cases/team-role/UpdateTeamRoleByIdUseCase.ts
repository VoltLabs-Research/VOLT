import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateTeamRoleByIdInputDTO, UpdateTeamRoleByIdOutputDTO } from '@modules/team/application/dtos/team-role/UpdateTeamRoleByIdDTO';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamRoleUpdatedEvent from '@modules/team/domain/events/TeamRoleUpdatedEvent';

@injectable()
export default class UpdateTeamRoleByIdUseCase implements IUseCase<UpdateTeamRoleByIdInputDTO, UpdateTeamRoleByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
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

        await this.eventBus.publish(new TeamRoleUpdatedEvent({
            teamRoleId: input.roleId,
            teamId: teamRole.props.team?.toString() ?? '',
            name: teamRole.props.name,
            permissions: teamRole.props.permissions
        }));

        return Result.ok(teamRole.props);
    }
}