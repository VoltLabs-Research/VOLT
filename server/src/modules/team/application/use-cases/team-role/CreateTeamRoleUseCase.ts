import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO } from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';
import TeamRole from '@modules/team/domain/entities/team-role/TeamRole';
import TeamRoleCreatedEvent from '@modules/team/domain/events/team-role/TeamRoleCreatedEvent';
import { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class CreateTeamRoleUseCase implements IUseCase<CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTeamRoleInputDTO): Promise<Result<CreateTeamRoleOutputDTO, ApplicationError>> {
        const {
            teamId,
            name,
            permissions,
            isSystem,
            userId
        } = input;

        const newRole = await this.teamRoleRepository.create(TeamRole.create({
            teamId,
            name,
            permissions,
            isSystem
        }));

        await this.eventBus.publish(new TeamRoleCreatedEvent({
            teamRoleId: newRole._id,
            teamId: String(newRole.props.team),
            name: newRole.props.name,
            userId
        }));

        return Result.ok(toPersistedOutput(newRole));
    }
};
