import TeamMemberLeaveEvent from '@modules/team/domain/events/team-member/TeamMemberLeaveEvent';
import TeamMembershipService from '@modules/team/infrastructure/services/team/TeamMembershipService';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team-member.left')
export default class TeamMemberLeaveEventHandler implements IEventHandler<TeamMemberLeaveEvent>{
    constructor(
        
        private readonly teamMembershipService: TeamMembershipService
    ){}

    async handle(event: TeamMemberLeaveEvent): Promise<void>{
        const { teamId, memberId } = event.payload;

        await this.teamMembershipService.removeMemberFromTeam(memberId, teamId);
    }
};
