import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { UpdateTeamRoleByIdInputDTO, UpdateTeamRoleByIdOutputDTO } from '@modules/team/application/dtos/team-role/UpdateTeamRoleByIdDTO';
import TeamRoleUpdatedEvent from '@modules/team/domain/events/team-role/TeamRoleUpdatedEvent';
import { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class UpdateTeamRoleByIdUseCase implements IUseCase<UpdateTeamRoleByIdInputDTO, UpdateTeamRoleByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: UpdateTeamRoleByIdInputDTO): Promise<Result<UpdateTeamRoleByIdOutputDTO, ApplicationError>> {
        const currentRole = await this.teamRoleRepository.findById(input.roleId);

        if (!currentRole) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            ));
        }

        if (!currentRole.canRenameTo(input.name)) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_ROLE_IS_SYSTEM,
                'Cannot rename system roles'
            ));
        }

        const updateData = currentRole.getUpdatePayload({
            name: input.name,
            permissions: input.permissions
        });

        const teamRole = await this.teamRoleRepository.updateById(input.roleId, updateData);

        if (!teamRole) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Failed to update team role'
            ));
        }

        await this.eventBus.publish(new TeamRoleUpdatedEvent({
            teamRoleId: teamRole._id,
            teamId: String(teamRole.props.team),
            name: teamRole.props.name,
            permissions: teamRole.props.permissions
        }));

        return Result.ok(toPersistedOutput(teamRole));
    }
};
