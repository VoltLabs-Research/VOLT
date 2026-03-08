import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ITeamRoleRepository } from '@modules/team/domain/port/ITeamRoleRepository';
import { ITeamRepository } from '@modules/team/domain/port/ITeamRepository';
import { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';
import { ErrorCodes } from '@core/constants/error-codes';
import logger from '@shared/infrastructure/logger';

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
            logger.warn({ teamId, memberId, code: ErrorCodes.TEAM_NOT_FOUND }, 'Team leave operation ignored');
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
            logger.warn({ teamId, memberId, code: ErrorCodes.TEAM_ROLE_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        const ownersCount = await this.teamMemberRepository.count({ role: ownerRole._id });
        if (ownersCount !== 0) {
            return;
        }

        const randomMember = await this.teamMemberRepository.findOne({ team: teamId });
        if (!randomMember) {
            logger.warn({ teamId, memberId, code: ErrorCodes.TEAM_MEMBER_NOT_FOUND }, 'Team leave operation ignored');
            return;
        }

        await this.teamMemberRepository.updateById(randomMember._id, { role: ownerRole._id });
    }
}
