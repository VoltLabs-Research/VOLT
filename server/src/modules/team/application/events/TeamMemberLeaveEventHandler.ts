import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject } from 'tsyringe';
import TeamMemberLeaveEvent from '@modules/team/domain/events/TeamMemberLeaveEvent';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import { ITeamRepository } from '@modules/team/domain/ports/ITeamRepository';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';

@injectable()
export default class TeamMemberLeaveEventHandler implements IEventHandler<TeamMemberLeaveEvent>{
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,

        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    async handle(event: TeamMemberLeaveEvent): Promise<void>{
        const { teamId, memberId } = event.payload;

        await this.teamRepository.removeUserFromTeam(memberId, teamId);
        await this.teamMemberRepository.deleteById(memberId);

        const membersCount = await this.teamMemberRepository.count({ team: teamId });
        const team = await this.teamRepository.findById(teamId);
        if(!team){
            throw new Error(ErrorCodes.TEAM_NOT_FOUND);       
        }

        // If the team contains no members, we remove it.
        if(membersCount === 0){
            await this.teamRepository.deleteById(team.id);
            await this.eventBus.publish(new TeamDeletedEvent({ teamId }));
            return;
        }

        // If the team does not contain any member with the "Owner" role,
        // we randomly delegate the role to another member of the group.
        const ownerRole = await this.teamRoleRepository.findOne({
            team: team.id,
            name: 'Owner',
            isSystem: true
        });

        if(!ownerRole){
            throw Error(ErrorCodes.TEAM_ROLE_NOT_FOUND);
        }

        const ownersCount = await this.teamMemberRepository.count({ role: ownerRole.id });
        if(ownersCount != 0) return;

        const randomMember = await this.teamMemberRepository.findOne({ team: teamId });
        if(!randomMember){
            throw Error(ErrorCodes.TEAM_MEMBER_NOT_FOUND);
        }

        await this.teamMemberRepository.updateById(randomMember.id, { role: ownerRole.id });
    }
};