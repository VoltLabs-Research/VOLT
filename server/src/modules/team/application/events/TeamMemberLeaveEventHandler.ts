import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamMembershipService from '@modules/team/application/services/team/TeamMembershipService';
import TeamMemberLeaveEvent from '@modules/team/domain/events/team-member/TeamMemberLeaveEvent';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class TeamMemberLeaveEventHandler implements IEventHandler<TeamMemberLeaveEvent>{
    constructor(
        @inject(TEAM_TOKENS.TeamMembershipService)
        private readonly teamMembershipService: TeamMembershipService
    ){}

    async handle(event: TeamMemberLeaveEvent): Promise<void>{
        const { teamId, memberId } = event.payload;

        await this.teamMembershipService.removeMemberFromTeam(memberId, teamId);
    }
};
