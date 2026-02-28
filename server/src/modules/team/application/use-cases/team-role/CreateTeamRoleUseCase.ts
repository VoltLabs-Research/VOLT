import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO } from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamRoleCreatedEvent from '@modules/team/domain/events/TeamRoleCreatedEvent';

@injectable()
export default class CreateTeamRoleUseCase implements IUseCase<CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
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

        await this.eventBus.publish(new TeamRoleCreatedEvent({
            teamRoleId: newRole.id,
            teamId,
            name
        }));

        return Result.ok(newRole.props);
    }
};