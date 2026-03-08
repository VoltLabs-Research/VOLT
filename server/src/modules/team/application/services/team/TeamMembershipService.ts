import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { injectable, inject } from 'tsyringe';

const logMembershipWarning = (context: Record<string, string>, message: string) => {
    console.warn('[TeamMembershipService]', message, context);
};

@injectable()
export default class TeamMembershipService {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,

        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async removeMemberFromTeam(memberId: string, teamId: string): Promise<void> {
        await this.teamRepository.removeUserFromTeam(memberId, teamId);
        await this.teamMemberRepository.deleteById(memberId);

        const membersCount = await this.teamMemberRepository.count({ team: teamId });
        const team = await this.teamRepository.findById(teamId);
        if (!team) {
            logMembershipWarning({ teamId, memberId, code: ErrorCodes.TEAM_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        if (membersCount === 0) {
            await this.teamRepository.deleteById(team._id);
            await this.eventBus.publish(new TeamDeletedEvent({ teamId }));
            return;
        }

        const ownerRole = await this.teamRoleRepository.findOne({
            team: team._id,
            name: 'Owner',
            isSystem: true
        });

        if (!ownerRole) {
            logMembershipWarning({ teamId, memberId, code: ErrorCodes.TEAM_ROLE_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        const ownersCount = await this.teamMemberRepository.count({ role: ownerRole._id });
        if (ownersCount !== 0) {
            return;
        }

        const randomMember = await this.teamMemberRepository.findOne({ team: teamId });
        if (!randomMember) {
            logMembershipWarning({ teamId, memberId, code: ErrorCodes.TEAM_MEMBER_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        await this.teamMemberRepository.updateById(randomMember._id, { role: ownerRole._id });
    }
};
