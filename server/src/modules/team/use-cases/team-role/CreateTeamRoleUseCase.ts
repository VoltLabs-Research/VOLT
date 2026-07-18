import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO } from '@modules/team/dtos/team-role/CreateTeamRoleDTO';
import TeamRole from '@modules/team/entities/team-role/TeamRole';
import TeamRoleCreatedEvent from '@modules/team/events/team-role/TeamRoleCreatedEvent';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CreateTeamRoleUseCase implements IUseCase<CreateTeamRoleInputDTO, CreateTeamRoleOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateTeamRoleInputDTO): Promise<CreateTeamRoleOutputDTO> {
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
            permissions: permissions ?? [],
            isSystem: isSystem ?? false
        }));

        await this.eventBus.publish(new TeamRoleCreatedEvent({
            teamRoleId: newRole._id,
            teamId: String(newRole.props.team),
            name: newRole.props.name,
            userId
        }));

        return toPersistedOutput(newRole);
    }
}
