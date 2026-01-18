import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject } from 'tsyringe';
import TeamCreatedEvent from '@modules/team/domain/events/TeamCreatedEvent';
import CreateTeamRoleUseCase from '@modules/team/application/use-cases/team-role/CreateTeamRoleUseCase';
import { SystemRoles } from '@core/constants/system-roles';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import CreateTeamMemberUseCase from '@modules/team/application/use-cases/team-member/CreateTeamMemberUseCase';

@injectable()
export default class TeamCreatedEventHandler implements IEventHandler<TeamCreatedEvent>{
    constructor(
        @inject(CreateTeamRoleUseCase)
        private readonly createTeamRoleUseCase: CreateTeamRoleUseCase,

        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,

        @inject(CreateTeamMemberUseCase)
        private readonly createTeamMemberUseCase: CreateTeamMemberUseCase
    ){}

    async handle(event: TeamCreatedEvent): Promise<void>{
        const { teamId, ownerId } = event.payload;

        const roles = Object.values(SystemRoles).map((role) => ({
            teamId,
            name: role.name,
            permissions: [...role.permissions],
            isSystem: true
        }));

        await Promise.all(roles.map((role) => this.createTeamRoleUseCase.execute(role)));

        const ownerRole = await this.teamRoleRepository.findOne({
            team: teamId,
            name: 'Owner',
            isSystem: true
        });

        if(ownerRole){
            await this.createTeamMemberUseCase.execute({
                roleId: ownerRole.id,
                teamId,
                userId: ownerId
            });
        }
    }
};