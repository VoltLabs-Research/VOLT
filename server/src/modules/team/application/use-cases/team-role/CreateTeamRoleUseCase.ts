import { ITeamRoleRepository } from '@modules/team/domain/port/ITeamRoleRepository';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO } from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamRoleCreatedEvent from '@modules/team/domain/events/TeamRoleCreatedEvent';
import { createTeamRoleInputSchema } from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';
import TeamRole from '@modules/team/domain/entities/TeamRole';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';

@injectable()
export default class CreateTeamRoleUseCase implements IUseCase<CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTeamRoleInputDTO): Promise<Result<CreateTeamRoleOutputDTO, ApplicationError>> {
        const parsed = createTeamRoleInputSchema.safeParse(input);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0];
            return Result.fail(ApplicationError.badRequest(
                firstError.message,
                firstError.message
            ));
        }

        const { teamId, name, permissions, isSystem } = parsed.data;

        const newRole = await this.teamRoleRepository.create(TeamRole.create({
            teamId,
            name,
            permissions,
            isSystem
        }));

        await this.eventBus.publish(new TeamRoleCreatedEvent({
            teamRoleId: newRole._id,
            teamId: String(newRole.props.team),
            name: newRole.props.name
        }));

        return Result.ok(toPersistedOutput(newRole));
    }
}
