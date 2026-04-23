import { ErrorCodes } from '@core/constants/error-codes';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

const logMembershipWarning = (context: Record<string, string>, message: string) => {
    console.warn('[TeamMembershipService]', message, context);
};

@Singleton()
export default class TeamMembershipService {
    constructor(
        
        private readonly teamRoleRepository: TeamRoleRepository,

        
        private readonly teamRepository: TeamRepository,

        
        private readonly teamMemberRepository: TeamMemberRepository,

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
